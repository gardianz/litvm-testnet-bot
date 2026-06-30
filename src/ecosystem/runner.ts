import type { Ctx } from "../steps/types.js";
import { DAPPS, type Built } from "./dapps.js";
import { assertChain } from "../evm.js";
import { replayCalldata } from "../arkada/onchain.js";
import { ranToday, markRan } from "../state.js";

// Run each enabled ecosystem dApp action once per UTC day. Each is simulated
// (eth_call) before broadcasting; a revert (e.g. fee/cooldown) is reported and
// skipped without spending gas.
export async function runEcosystem(ctx: Ctx): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of ctx.cfg.ecosystem.dapps) {
    const dapp = DAPPS[key];
    if (!dapp) { out[key] = "unknown-dapp"; continue; }
    if (ranToday(ctx.state, `eco:${key}`)) { out[key] = "daily-done"; continue; }

    let built: Built;
    if (dapp.build) {
      built = dapp.build(ctx.clients.address);
    } else if (dapp.replay) {
      const r = await replayCalldata(ctx.cfg.explorerApi, dapp.to, ctx.clients.address);
      if (!r) { out[key] = "no-replay"; continue; }
      built = { to: dapp.to, data: r.data, value: r.value };
    } else { out[key] = "no-builder"; continue; }
    const params = { account: ctx.clients.address, to: built.to, data: built.data, value: built.value };
    try {
      await ctx.clients.public.call(params);
    } catch (e) {
      out[key] = `revert:${((e as any).shortMessage ?? (e as Error).message).slice(0, 40)}`;
      continue;
    }
    if (ctx.dryRun) { out[key] = "dry:ok"; continue; }
    try {
      await assertChain(ctx.clients.public);
      const hash = await ctx.clients.wallet.sendTransaction({ ...params, account: ctx.clients.wallet.account });
      const rcpt = await ctx.clients.public.waitForTransactionReceipt({ hash });
      if (rcpt.status !== "success") { out[key] = "tx-reverted"; continue; }
      markRan(ctx.acc.id, `eco:${key}`, { txs: [hash] });
      out[key] = hash;
      ctx.log(`${key}: ${hash}`);
    } catch (e) {
      out[key] = `send:${(e as Error).message.slice(0, 40)}`;
    }
  }
  return out;
}
