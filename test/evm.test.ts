import { describe, it, expect } from "vitest";
import { defineLiteforge, assertChain } from "../src/evm.js";

describe("evm", () => {
  it("defines chain id 4441 / zkLTC", () => {
    const c = defineLiteforge("https://x");
    expect(c.id).toBe(4441);
    expect(c.nativeCurrency.symbol).toBe("zkLTC");
  });
  it("assertChain throws on wrong chain", async () => {
    await expect(assertChain({ getChainId: async () => 1 } as any)).rejects.toThrow(/4441/);
  });
  it("assertChain passes on 4441", async () => {
    await expect(assertChain({ getChainId: async () => 4441 } as any)).resolves.toBeUndefined();
  });
});
