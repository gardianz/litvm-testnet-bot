import { describe, it, expect, vi } from "vitest";
import { parseChecks, replayCalldata, countTxsTo } from "../src/arkada/onchain.js";

const EXPR = (addrs: string[], n: number) =>
  `function(response,$data){const validAddresses=[${addrs.map((a) => `'${a}'`).join(",")}];const matchedCount=response.items.filter(x=>x).length;return matchedCount >= ${n} ? 1 : 0;}`;

describe("parseChecks", () => {
  it("extracts validAddresses + threshold", () => {
    const r = parseChecks({ checks: [{ expression: EXPR(["0xEb5600899BD87F0dF9200dEaD5B8098B63708C75"], 5) }] });
    expect(r.targets).toEqual(["0xEb5600899BD87F0dF9200dEaD5B8098B63708C75"]);
    expect(r.minCount).toBe(5);
  });
  it("defaults to empty/1 when no checks", () => {
    expect(parseChecks(undefined)).toEqual({ targets: [], minCount: 1 });
  });
});

describe("replayCalldata", () => {
  it("replays a successful tx and redirects sender to me", async () => {
    const from = "0x" + "11".repeat(20);
    const me = "0x" + "22".repeat(20);
    const raw = "0xabcdef01" + "000000000000000000000000" + "11".repeat(20);
    const fetchImpl = vi.fn().mockResolvedValueOnce({ json: async () => ({ items: [{ result: "success", raw_input: raw, from: { hash: from }, value: "1000" }] }) } as any);
    const r = await replayCalldata("https://e", "0xc0", me, fetchImpl);
    expect(r?.value).toBe(1000n);
    expect(r?.data).toBe("0xabcdef01" + "000000000000000000000000" + "22".repeat(20));
  });
  it("returns null when no replayable tx", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ json: async () => ({ items: [{ result: "error", raw_input: "0xdead" }] }) } as any);
    expect(await replayCalldata("https://e", "0xc0", "0xme", fetchImpl)).toBeNull();
  });
});

describe("countTxsTo", () => {
  it("counts successful txs to the contract", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ json: async () => ({ items: [
      { result: "success", to: { hash: "0xCONTRACT" } },
      { result: "success", to: { hash: "0xother" } },
      { result: "error", to: { hash: "0xcontract" } },
      { result: "success", to: { hash: "0xcontract" } },
    ] }) } as any);
    expect(await countTxsTo("https://e", "0xme", "0xContract", fetchImpl)).toBe(2);
  });
});
