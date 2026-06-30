import { parseAbi } from "viem";
import type { Ctx } from "../steps/types.js";
import type { QuestAction } from "../config.js";
import { assertChain } from "../evm.js";

export function coerceArgs(args: (string | number | boolean)[]): unknown[] {
  return args.map((a) => (typeof a === "string" && /^\d+$/.test(a) ? BigInt(a) : a));
}

export async function runAction(ctx: Ctx, action: QuestAction): Promise<{ ran: boolean; tx?: string; reason?: string }> {
  let abi;
  try { abi = parseAbi([action.signature]); }
  catch { return { ran: false, reason: `bad-signature:${action.signature}` }; }
  const fn = (abi[0] as any).name as string;
  const params = {
    address: action.address as `0x${string}`, abi, functionName: fn,
    args: coerceArgs(action.args), value: BigInt(action.valueWei || "0"), account: ctx.clients.wallet.account,
  };
  const sim = await ctx.clients.public.simulateContract(params);
  if (ctx.dryRun) { ctx.log(`action ${fn}: dry-run simulate ok`); return { ran: true }; }
  await assertChain(ctx.clients.public);
  const hash = await ctx.clients.wallet.writeContract(sim.request);
  await ctx.clients.public.waitForTransactionReceipt({ hash });
  ctx.log(`action ${fn}: ${hash}`);
  return { ran: true, tx: hash };
}
