import { describe, it, expect, vi } from "vitest";
import { coerceArgs, runAction } from "../src/arkada/actions.js";

describe("quest actions", () => {
  it("coerces decimal strings to bigint, leaves others", () => {
    expect(coerceArgs(["123", "hello", 5, true])).toEqual([123n, "hello", 5, true]);
  });
  it("dry-run simulates only, no write", async () => {
    const sim = vi.fn(async () => ({ request: {} }));
    const write = vi.fn();
    const ctx: any = { dryRun: true, log: () => {}, clients: { public: { simulateContract: sim, getChainId: async () => 4441 }, wallet: { writeContract: write, account: { address: "0xabc" } }, address: "0xabc" } };
    const r = await runAction(ctx, { address: "0xc0", signature: "function gm()", args: [], valueWei: "0" });
    expect(r.ran).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });
  it("live path writes and returns tx", async () => {
    const ctx: any = {
      dryRun: false, log: () => {},
      clients: {
        public: { simulateContract: async () => ({ request: {} }), getChainId: async () => 4441, waitForTransactionReceipt: async () => ({}) },
        wallet: { writeContract: async () => "0xtx", account: { address: "0xabc" } }, address: "0xabc",
      },
    };
    const r = await runAction(ctx, { address: "0xc0", signature: "function gm()", args: [], valueWei: "0" });
    expect(r).toMatchObject({ ran: true, tx: "0xtx" });
  });
});
