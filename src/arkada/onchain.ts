// On-chain quest fulfilment for Arkada.
//
// Arkada verifies an on-chain quest by querying the liteforge explorer for the
// user's transactions and counting successes whose `to` is one of the quest's
// `validAddresses` (parsed from the quest's value.checks expression), with
// `matchedCount >= N`. Method/calldata are NOT inspected — only from/to/success.
//
// So to satisfy a quest we send N successful txs to the target contract. We get
// valid calldata by replaying a recent successful tx to that contract (with the
// original sender's address swapped for ours so mints/claims credit us), guarded
// by simulation and a value cap. Calls that revert on replay (swaps with
// deadlines/amounts) are skipped — the quest is reported not-verified.

export type Checks = { targets: string[]; minCount: number };

// Parse validAddresses + threshold from a quest's value.checks expression(s).
export function parseChecks(value: any): Checks {
  const checks = value?.checks ?? [];
  const targets = new Set<string>();
  let minCount = 1;
  for (const c of checks) {
    const ex = String(c?.expression ?? "");
    const arrM = ex.match(/validAddresses\s*=\s*\[([^\]]*)\]/);
    if (arrM) for (const a of arrM[1].match(/0x[0-9a-fA-F]{40}/g) ?? []) targets.add(a);
    else for (const a of ex.match(/0x[0-9a-fA-F]{40}/g) ?? []) targets.add(a);
    const cntM = ex.match(/matchedCount\s*>=\s*(\d+)/) ?? ex.match(/>=\s*(\d+)\s*\?\s*1/);
    if (cntM) minCount = Math.max(minCount, Number(cntM[1]));
  }
  return { targets: [...targets], minCount };
}

const pad = (addr: string) => "000000000000000000000000" + addr.toLowerCase().replace(/^0x/, "");

// Build replay calldata from a recent successful tx to `contract`, redirecting the
// original sender's address to `myAddr`. Returns null when no replayable tx found.
export async function replayCalldata(
  explorerApi: string, contract: string, myAddr: string, fetchImpl?: typeof fetch,
): Promise<{ data: `0x${string}`; value: bigint } | null> {
  const f = fetchImpl ?? fetch;
  let j: any;
  try {
    const r = await f(`${explorerApi}/api/v2/addresses/${contract}/transactions?filter=to`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    j = await r.json();
  } catch { return null; }
  const items: any[] = j?.items ?? [];
  const sample = items.find((i) => i?.result === "success" && typeof i?.raw_input === "string" && i.raw_input.length > 10);
  if (!sample) return null;
  let data = sample.raw_input as string;
  const from = sample.from?.hash ?? sample.from;
  if (typeof from === "string" && /^0x[0-9a-fA-F]{40}$/.test(from)) {
    data = data.replaceAll(pad(from), pad(myAddr));
  }
  return { data: data as `0x${string}`, value: BigInt(sample.value ?? "0") };
}

// Count the wallet's successful txs whose `to` is the contract.
export async function countTxsTo(
  explorerApi: string, myAddr: string, contract: string, fetchImpl?: typeof fetch,
): Promise<number> {
  const f = fetchImpl ?? fetch;
  let j: any;
  try {
    const r = await f(`${explorerApi}/api/v2/addresses/${myAddr}/transactions?filter=from`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    j = await r.json();
  } catch { return 0; }
  const items: any[] = j?.items ?? [];
  const c = contract.toLowerCase();
  return items.filter((i) => i?.result === "success" && (i?.to?.hash ?? i?.to ?? "").toLowerCase() === c).length;
}
