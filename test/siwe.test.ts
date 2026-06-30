import { describe, it, expect } from "vitest";
import { buildSiweMessage } from "../src/siwe.js";

describe("siwe", () => {
  it("builds an EIP-4361 message with all fields", () => {
    const m = buildSiweMessage({
      domain: "app.arkada.gg", address: "0xABC", statement: "Sign in",
      uri: "https://app.arkada.gg", nonce: "n123", chainId: 4441, issuedAt: "2026-06-30T00:00:00Z",
    });
    expect(m).toContain("app.arkada.gg wants you to sign in");
    expect(m).toContain("0xABC");
    expect(m).toContain("Sign in");
    expect(m).toContain("Chain ID: 4441");
    expect(m).toContain("Nonce: n123");
    expect(m).toContain("Issued At: 2026-06-30T00:00:00Z");
  });
});
