import { describe, it, expect } from "vitest";
import { registerStep } from "../src/steps/register.js";

describe("register", () => {
  it("shouldRun false once done", async () => {
    const ctx: any = { cfg: { steps: { register: true } }, state: { register: { done: true } } };
    expect(await registerStep.shouldRun(ctx)).toBe(false);
  });
  it("skips when registerApi unset", async () => {
    const ctx: any = { cfg: { registerApi: undefined, chainId: 4441 }, state: {}, dryRun: false, clients: { address: "0xabc" }, log: () => {}, acc: { id: "acc1" } };
    expect(await registerStep.run(ctx)).toBe("skipped");
  });
});
