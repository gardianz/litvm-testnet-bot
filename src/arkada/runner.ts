import type { Ctx } from "../steps/types.js";
import type { Quest } from "./client.js";
import { arkadaLogin } from "./auth.js";
import { listCampaignSlugs, getQuests, checkQuest, completeQuest, isSocial } from "./client.js";
import { runAction } from "./actions.js";
import { signSiwe } from "../siwe.js";
import { ranToday, markRan } from "../state.js";

export type RunnerDeps = {
  login: (ctx: Ctx) => Promise<{ token: string } | null>;
  listSlugs: (token: string) => Promise<string[]>;
  getQuests: (slug: string, token: string) => Promise<Quest[]>;
  check: (id: string, token: string) => Promise<boolean>;
  complete: (id: string, token: string) => Promise<boolean>;
  action: typeof runAction;
};

async function depLogin(ctx: Ctx): Promise<{ token: string } | null> {
  return arkadaLogin({ arkada: ctx.cfg.arkada, address: ctx.clients.address, sign: (m) => signSiwe(ctx.clients.wallet, m) });
}

function isDaily(slug: string): boolean { return slug.endsWith("-daily"); }

export async function runQuests(ctx: Ctx, deps?: Partial<RunnerDeps>): Promise<Record<string, string>> {
  const d: RunnerDeps = {
    login: deps?.login ?? depLogin,
    listSlugs: deps?.listSlugs ?? ((t) => listCampaignSlugs(ctx.cfg.arkada, t)),
    getQuests: deps?.getQuests ?? ((s, t) => getQuests(ctx.cfg.arkada, s, t)),
    check: deps?.check ?? ((id, t) => checkQuest(ctx.cfg.arkada, id, t)),
    complete: deps?.complete ?? ((id, t) => completeQuest(ctx.cfg.arkada, id, t)),
    action: deps?.action ?? runAction,
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
      if (daily) { if (ranToday(ctx.state, key)) { out[tag] = "daily-done"; continue; } }
      else if (ctx.state[key]?.done) { out[tag] = "already"; continue; }

      if (ctx.dryRun) { out[tag] = `dry:${q.type || "?"}`; continue; }

      // on-chain quests: run mapped action (if any), then Arkada must confirm via check-quest.
      if (q.type !== "link") {
        const mapped = ctx.cfg.questActions[q.id] ?? ctx.cfg.questActions[slug];
        if (mapped) {
          const a = await d.action(ctx, mapped);
          if (!a.ran) { out[tag] = `action-fail:${a.reason ?? "?"}`; continue; }
          if (a.tx) markRan(ctx.acc.id, key, { txs: [a.tx] });
        }
        if (!(await d.check(q.id, token))) { out[tag] = mapped ? "not-verified" : "unmapped"; continue; }
      }

      const ok = await d.complete(q.id, token);
      markRan(ctx.acc.id, key, { done: !daily });
      out[tag] = ok ? "done" : "claim-fail";
    }
  }
  return out;
}
