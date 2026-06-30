import type { Ctx } from "../steps/types.js";
import type { Quest } from "./client.js";
import { arkadaLogin } from "./auth.js";
import { listQuests, verifyQuest, claimQuest } from "./client.js";
import { runAction } from "./actions.js";
import { signSiwe } from "../siwe.js";
import { ranToday, markRan } from "../state.js";

export type RunnerDeps = {
  login: typeof depLogin;
  list: (token: string) => Promise<Quest[]>;
  verify: (token: string, id: string) => Promise<boolean>;
  claim: (token: string, id: string) => Promise<boolean>;
  action: typeof runAction;
};

async function depLogin(ctx: Ctx): Promise<{ token: string } | null> {
  return arkadaLogin({
    arkada: ctx.cfg.arkada, address: ctx.clients.address, chainId: ctx.cfg.chainId,
    sign: (msg) => signSiwe(ctx.clients.wallet, msg),
  });
}

export async function runQuests(ctx: Ctx, deps?: Partial<RunnerDeps>): Promise<Record<string, string>> {
  const d: RunnerDeps = {
    login: deps?.login ?? depLogin,
    list: deps?.list ?? ((token) => listQuests({ arkada: ctx.cfg.arkada, token })),
    verify: deps?.verify ?? ((token, id) => verifyQuest({ arkada: ctx.cfg.arkada, token, questId: id })),
    claim: deps?.claim ?? ((token, id) => claimQuest({ arkada: ctx.cfg.arkada, token, questId: id })),
    action: deps?.action ?? runAction,
  };
  const session = await d.login(ctx);
  if (!session) return { arkada: "no-login" };

  const quests = await d.list(session.token);
  const out: Record<string, string> = {};
  for (const q of quests) {
    const dailyDue = q.daily && !ranToday(ctx.state, `quest:${q.slug}`);
    if (q.completed && !dailyDue) { out[q.slug] = "already"; continue; }
    const mapped = ctx.cfg.questActions[q.slug];
    if (!mapped) { out[q.slug] = "unmapped"; ctx.log(`quest ${q.slug}: no action mapping — skip`); continue; }
    const a = await d.action(ctx, mapped);
    if (!a.ran) { out[q.slug] = `action-fail:${a.reason ?? "?"}`; continue; }
    if (ctx.dryRun) { out[q.slug] = "ran"; continue; }
    const verified = await d.verify(session.token, q.id);
    if (!verified) { out[q.slug] = "verify-fail"; continue; }
    const claimed = await d.claim(session.token, q.id);
    markRan(ctx.acc.id, `quest:${q.slug}`, { txs: a.tx ? [a.tx] : [], done: !q.daily });
    out[q.slug] = claimed ? "done" : "verified";
  }
  return out;
}
