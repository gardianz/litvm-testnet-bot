// Aura (beta.auralaunch.org) off-chain incentive points — headless, no browser.
//
// Reverse-engineered from the app bundle + verified live:
//   1. auth: sign the STATIC message `auth:${address}` (personal_sign, no nonce),
//      POST /api/auth {address, signature} -> { token }. Send token as cookie `aura_token`.
//   2. daily login: POST /api/auth/me/claim -> +20 pts, builds a streak (7-day bonus).
//   3. tasks: GET /api/incentives/me -> { tasks[] }; for each OPEN, non-social task
//      POST /api/incentives/tasks/{task_id}/verify?index=0. The server gates each on the
//      real requirement (e.g. 50+ txns, first stake) — so it only awards once the wallet's
//      on-chain ecosystem activity satisfies it. Social tasks (X/Discord/Telegram) need
//      OAuth/manual steps -> skipped.
//
// Points to 1000 without social: complete_50_plus_transactions (1250) + 7-day streak (320)
// + wallet-connect (25) + first-stake (50) + buy-tokens (20) + 20/day login + ~16/txn.

import { fetch as uf } from "undici";
import { privateKeyToAccount } from "viem/accounts";
import { dispatcherFor } from "../proxies.js";
import type { Ctx } from "../steps/types.js";
import { ranToday, markRan } from "../state.js";

const AURA = "https://beta.auralaunch.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
// social tasks need real OAuth (X/Discord) or a manual Telegram message — server-gated on
// profile.twitter_username/discord_username, NOT bypassable via the API. Skip, like Arkada social.
const SKIP_TASKS = new Set(["connect_x", "follow_x", "connect_discord", "join_telegram"]);

type Task = { task_id: string; name: string; points: number; completed: boolean };

// tiny cookie jar over undici fetch, routed through the account's proxy (own IP).
function client(dispatcher: any) {
  const jar = new Map<string, string>();
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  return async (path: string, opts: any = {}) => {
    const res = await uf(AURA + path, {
      ...opts, dispatcher,
      headers: { "user-agent": UA, "content-type": "application/json", cookie: cookie(), ...(opts.headers || {}) },
    });
    for (const c of (res.headers.getSetCookie?.() ?? [])) { const kv = c.split(";")[0]; const i = kv.indexOf("="); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
    const text = await res.text();
    let json: any; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, text, json, setToken: (t: string) => jar.set("aura_token", t) };
  };
}

// auth + daily-claim + verify open non-social tasks. daily-gated per account.
export async function runAuraPoints(ctx: Ctx): Promise<Record<string, string>> {
  const key = "flow:aura:points";
  const tag = "aura.points";
  if (ranToday(ctx.state, key)) { ctx.report?.(tag, "daily-done"); return { [tag]: "daily-done" }; }
  if (ctx.dryRun) { ctx.report?.(tag, "dry"); return { [tag]: "dry" }; }

  const acct = privateKeyToAccount(ctx.acc.pk);
  const req = client(dispatcherFor(ctx.acc.proxy));
  try {
    // 1) auth
    const sig = await acct.signMessage({ message: `auth:${acct.address}` });
    const au = await req("/api/auth", { method: "POST", body: JSON.stringify({ address: acct.address, signature: sig }) });
    if (au.status !== 200 || !au.json?.token) { const s = `auth-fail(${au.status})`; ctx.report?.(tag, s); return { [tag]: s }; }
    au.setToken(au.json.token); // ensure aura_token cookie is set from the response body

    // 2) daily login claim (+20, streak)
    let login = "";
    const cl = await req("/api/auth/me/claim", { method: "POST" });
    if (cl.json?.status === "success") login = `+${cl.json.points_added ?? 0} login(streak ${cl.json.new_streak ?? "?"})`;
    else login = `login:${(cl.json?.message ?? cl.status)}`.slice(0, 24);

    // 3) verify open, non-social tasks
    const me = await req("/api/incentives/me");
    const tasks: Task[] = me.json?.tasks ?? [];
    let awarded = 0, done = 0, open = 0;
    for (const t of tasks) {
      if (t.completed || SKIP_TASKS.has(t.task_id)) continue;
      open++;
      const v = await req(`/api/incentives/tasks/${t.task_id}/verify?index=0`, { method: "POST" });
      if (v.json?.status === "success") { done++; awarded += t.points; ctx.log(`aura task ${t.task_id} +${t.points}`); }
      await new Promise((r) => setTimeout(r, 800));
    }
    const pts = me.json?.me?.[0]?.points;
    const status = `${login}; tasks ${done}/${open} +${awarded}${pts != null ? `; total ${pts}` : ""}`;
    markRan(ctx.acc.id, key, { data: { login, tasksDone: done, awarded } });
    ctx.report?.(tag, status);
    return { [tag]: status };
  } catch (e) {
    const s = `err:${(e as Error).message.slice(0, 30)}`; ctx.report?.(tag, s); return { [tag]: s };
  }
}
