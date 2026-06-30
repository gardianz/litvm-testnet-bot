import { parseAbi, encodeFunctionData } from "viem";
import type { Ctx } from "../steps/types.js";
import type { Quest } from "./client.js";
import { arkadaLogin } from "./auth.js";
import { listCampaignSlugs, getQuests, checkQuest, completeQuest, isSocial } from "./client.js";
import { replayCalldata, countTxsTo } from "./onchain.js";
import { coerceArgs } from "./actions.js";
import { signSiwe } from "../siwe.js";
import { ranToday, markRan } from "../state.js";

export type OnchainResult = { ok: boolean; sent: number; reason?: string; txs: string[] };

export type RunnerDeps = {
  login: (ctx: Ctx) => Promise<{ token: string } | null>;
  listSlugs: (token: string) => Promise<string[]>;
  getQuests: (slug: string, token: string) => Promise<Quest[]>;
  check: (id: string, token: string) => Promise<boolean>;
  complete: (id: string, token: string) => Promise<boolean>;
  onchain: (ctx: Ctx, q: Quest) => Promise<OnchainResult>;
};

async function depLogin(ctx: Ctx): Promise<{ token: string } | null> {
  return arkadaLogin({ arkada: ctx.cfg.arkada, address: ctx.clients.address, sign: (m) => signSiwe(ctx.clients.wallet, m) });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isDaily(slug: string): boolean { return slug.endsWith("-daily"); }

// Fulfil an on-chain quest: send successful txs to the target contract until the
// quest threshold is met. Uses an explicit questActions mapping if present, else
// replays a recent successful tx (sender redirected to us). Simulation + value cap
// guard each send; calls that revert (swaps with deadlines/amounts) abort safely.
export async function fulfilOnchain(ctx: Ctx, q: Quest): Promise<OnchainResult> {
  const a = ctx.cfg.arkada;
  const cap = BigInt(a.onchainMaxValueWei);
  const override = ctx.cfg.questActions[q.id] ?? ctx.cfg.questActions[q.slug];
  const to = (override?.address ?? q.targets[0]) as `0x${string}`;
  if (!to) return { ok: false, sent: 0, reason: "no-target", txs: [] };

  let count = await countTxsTo(ctx.cfg.explorerApi, ctx.clients.address, to);
  const txs: string[] = [];
  let sent = 0;
  while (count < q.minCount && sent < a.onchainMaxTx) {
    let data: `0x${string}`, value: bigint;
    if (override) {
      const abi = parseAbi([override.signature]) as any;
      data = encodeFunctionData({ abi, functionName: abi[0].name, args: coerceArgs(override.args) });
      value = BigInt(override.valueWei || "0");
    } else {
      const rep = await replayCalldata(ctx.cfg.explorerApi, to, ctx.clients.address);
      if (!rep) return { ok: false, sent, reason: "no-replay", txs };
      data = rep.data; value = rep.value;
    }
    if (value > cap) return { ok: false, sent, reason: "value-cap", txs };
    try {
      await ctx.clients.public.call({ account: ctx.clients.address, to, data, value });
    } catch { return { ok: false, sent, reason: "revert", txs }; }
    let hash: `0x${string}`;
    try {
      hash = await ctx.clients.wallet.sendTransaction({ to, data, value, account: ctx.clients.wallet.account });
      const rcpt = await ctx.clients.public.waitForTransactionReceipt({ hash });
      if (rcpt.status !== "success") return { ok: false, sent, reason: "tx-reverted", txs };
    } catch (e) { return { ok: false, sent, reason: `send:${(e as Error).message.slice(0, 40)}`, txs }; }
    txs.push(hash); sent++; count++;
    if (ctx.cfg.stepDelayMs) await sleep(Math.min(ctx.cfg.stepDelayMs, 3000));
  }
  return { ok: count >= q.minCount, sent, txs };
}

export async function runQuests(ctx: Ctx, deps?: Partial<RunnerDeps>): Promise<Record<string, string>> {
  const d: RunnerDeps = {
    login: deps?.login ?? depLogin,
    listSlugs: deps?.listSlugs ?? ((t) => listCampaignSlugs(ctx.cfg.arkada, t)),
    getQuests: deps?.getQuests ?? ((s, t) => getQuests(ctx.cfg.arkada, s, t)),
    check: deps?.check ?? ((id, t) => checkQuest(ctx.cfg.arkada, id, t)),
    complete: deps?.complete ?? ((id, t) => completeQuest(ctx.cfg.arkada, id, t)),
    onchain: deps?.onchain ?? fulfilOnchain,
  };
  const session = await d.login(ctx);
  if (!session) return { arkada: "no-login" };
  const token = session.token;

  const slugs = await d.listSlugs(token);
  const out: Record<string, string> = {};
  for (const slug of slugs) {
    if (isDaily(slug) && !ctx.cfg.arkada.includeDaily) continue;
    const quests = await d.getQuests(slug, token);
    for (const q of quests) {
      const key = `quest:${q.id}`;
      const daily = isDaily(slug);
      const tag = `${slug}/${q.name}`;
      if (ctx.cfg.arkada.skipSocial && isSocial(q.link, q.type)) { out[tag] = "social-skip"; continue; }
      const onchain = q.targets.length > 0;
      if (daily) { if (ranToday(ctx.state, key)) { out[tag] = "daily-done"; continue; } }
      else if (ctx.state[key]?.done) { out[tag] = "already"; continue; }

      if (ctx.dryRun) { out[tag] = onchain ? `dry:onchain x${q.minCount}` : `dry:${q.type || "?"}`; continue; }

      if (onchain) {
        if (!ctx.cfg.arkada.onchain) { out[tag] = "onchain-disabled"; continue; }
        const r = await d.onchain(ctx, q);
        if (r.txs.length) markRan(ctx.acc.id, key, { txs: r.txs });
        if (!r.ok) { out[tag] = `onchain-fail:${r.reason ?? "?"}(${r.sent})`; continue; }
        if (!(await d.check(q.id, token))) { out[tag] = `not-verified(sent ${r.sent})`; continue; }
      }

      const ok = await d.complete(q.id, token);
      markRan(ctx.acc.id, key, { done: !daily });
      out[tag] = ok ? (onchain ? "done-onchain" : "done") : "claim-fail";
    }
  }
  return out;
}
