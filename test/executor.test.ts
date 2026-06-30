import { describe, it, expect, vi } from "vitest";
import { runStep } from "../src/steps/executor.js";
import type { Step, Ctx } from "../src/steps/types.js";

const baseCtx = (): Ctx => ({
  cfg: {} as any, acc: { id: "acc1", pk: "0x1" } as any,
  clients: { public: {}, wallet: {}, address: "0xabc" } as any,
  state: {}, log: () => {}, dryRun: true,
});

describe("runStep", () => {
  it("skips when disabled", async () => {
    expect(await runStep({ name: "x", enabled: () => false, shouldRun: async () => true, run: async () => "ran" }, baseCtx())).toBe("skipped");
  });
  it("skips when shouldRun false", async () => {
    expect(await runStep({ name: "x", enabled: () => true, shouldRun: async () => false, run: async () => "ran" }, baseCtx())).toBe("skipped");
  });
  it("runs when enabled + shouldRun", async () => {
    const run = vi.fn(async () => "ran" as const);
    expect(await runStep({ name: "x", enabled: () => true, shouldRun: async () => true, run }, baseCtx())).toBe("ran");
    expect(run).toHaveBeenCalledOnce();
  });
  it("never throws; returns skipped on error", async () => {
    expect(await runStep({ name: "x", enabled: () => true, shouldRun: async () => true, run: async () => { throw new Error("boom"); } }, baseCtx())).toBe("skipped");
  });
});
