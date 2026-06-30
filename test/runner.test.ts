import { describe, it, expect, vi } from "vitest";

vi.mock("../src/evm.js", () => ({
  makeClients: () => ({ public: { getChainId: async () => 4441 }, wallet: {}, address: "0xabc" }),
  assertChain: async () => {},
}));

import { runAccount } from "../src/runner.js";
import type { Step } from "../src/steps/types.js";

describe("runner", () => {
  it("runs steps in order, collects results", async () => {
    const calls: string[] = [];
    const mk = (name: string): Step => ({ name, enabled: () => true, shouldRun: async () => true, run: async () => { calls.push(name); return "ran"; } });
    const res = await runAccount({ stepDelayMs: 0 } as any, { id: "acc1", pk: "0x1" } as any, { dryRun: true, steps: [mk("a"), mk("b")] });
    expect(calls).toEqual(["a", "b"]);
    expect(res.steps).toEqual({ a: "ran", b: "ran" });
  });
});
