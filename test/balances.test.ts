import { describe, it, expect } from "vitest";
import { hasMinGas } from "../src/balances.js";
import { parseEther } from "viem";

describe("balances", () => {
  it("true when balance >= min", async () => {
    expect(await hasMinGas({ getBalance: async () => parseEther("0.5") } as any, "0x0000000000000000000000000000000000000001", "0.1")).toBe(true);
  });
  it("false when balance < min", async () => {
    expect(await hasMinGas({ getBalance: async () => parseEther("0.05") } as any, "0x0000000000000000000000000000000000000001", "0.1")).toBe(false);
  });
});
