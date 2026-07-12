import type { Ctx } from "../steps/types.js";
import { FLOW_MAP, type Tx } from "./flows.js";
import { assertChain } from "../evm.js";
import { ranToday, markRan, saveStepState } from "../state.js";
import { runAuraPoints } from "./aura-points.js";

// Execute each configured dApp flow. A flow is an ordered list of steps; each step
// builds a sequence of txs (e.g. approve + action). Every tx is simulated (eth_call)
// before broadcast — a revert (cooldown, no gas, ratio) is logged and skipped, the
// rest continue. Gating: once = ever, daily = per UTC day, always = every run.
export async function runEcosystem(ctx: Ctx): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const dapp of ctx.cfg.ecosystem.dapps) {
    const flow = FLOW_MAP[dapp];
    if (!flow) { out[dapp] = "unknown-flow"; continue; }
    for (const step of flow.steps) {
      const tag = `${dapp}.${step.id}`;
      const key = `flow:${dapp}:${step.id}`;
      if (step.gate === "once" && ctx.state[key]?.done) { out[tag] = "done(once)"; ctx.report?.(tag, out[tag]); continue; }
      if (step.gate === "daily" && ranToday(ctx.state, key)) { out[tag] = "daily-done"; ctx.report?.(tag, out[tag]); continue; }

      let txs: Tx[];
      try { txs = await step.build({ address: ctx.clients.address, pub: ctx.clients.public }); }
      catch (e) { out[tag] = `build-fail:${(e as Error).message.slice(0, 30)}`; ctx.report?.(tag, out[tag]); continue; }
      if (txs.length === 0) { out[tag] = "nothing"; if (step.gate === "daily") markRan(ctx.acc.id, key); ctx.report?.(tag, out[tag]); continue; }

      const hashes: string[] = [];
      let okCount = 0, reverts = 0;
      for (const tx of txs) {
        const params = { account: ctx.clients.address, to: tx.to, data: tx.data, value: tx.value };
        try { await ctx.clients.public.call(params); }
        catch (e) { reverts++; ctx.log(`${tag}/${tx.label ?? ""}: revert ${((e as any).shortMessage ?? (e as Error).message).slice(0, 50)}`); continue; }
        if (ctx.dryRun) { okCount++; continue; }
        try {
          await assertChain(ctx.clients.public);
          const hash = await ctx.clients.wallet.sendTransaction({ ...params, account: ctx.clients.wallet.account });
          const r = await ctx.clients.public.waitForTransactionReceipt({ hash });
          if (r.status === "success") { okCount++; hashes.push(hash); ctx.log(`${tag}/${tx.label ?? ""}: ${hash}`); }
          else reverts++;
        } catch (e) { reverts++; ctx.log(`${tag}/${tx.label ?? ""}: send-fail ${(e as Error).message.slice(0, 40)}`); break; }
      }

      if (okCount > 0 && !ctx.dryRun) {
        if (step.gate === "once") saveStepState(ctx.acc.id, key, { done: true, txs: hashes });
        else if (step.gate === "daily") markRan(ctx.acc.id, key, { txs: hashes });
      }
      out[tag] = ctx.dryRun ? `dry(${okCount}/${txs.length})` : (hashes[0] ? `${hashes[0].slice(0, 12)}(${okCount}/${txs.length})` : `revert(${reverts})`);
      ctx.report?.(tag, out[tag]);
    }
  }

  // Aura off-chain incentive points — runs AFTER every on-chain flow so the wallet's tx
  // count / stake / buy already satisfy the server-side task gates. (daily-gated inside)
  if (ctx.cfg.ecosystem.dapps.includes("aura")) {
    Object.assign(out, await runAuraPoints(ctx));
  }
  return out;
}
