import { describe, it, expect, vi } from "vitest";
import { claimFaucet } from "../src/faucet.js";

describe("claimFaucet", () => {
  it("no-endpoint when endpoint missing", async () => {
    const r = await claimFaucet({ faucetUrl: "https://f", address: "0xabc" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-endpoint");
  });
  it("posts and returns ok (no sitekey path)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, txHash: "0xdead" }) } as any);
    const r = await claimFaucet({ faucetUrl: "https://f", address: "0xabc", endpoint: "https://f/api/claim", fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.tx).toBe("0xdead");
  });
});
