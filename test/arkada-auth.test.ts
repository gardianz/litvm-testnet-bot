import { describe, it, expect, vi } from "vitest";
import { arkadaLogin } from "../src/arkada/auth.js";

describe("arkadaLogin", () => {
  it("returns null when routes unset", async () => {
    const r = await arkadaLogin({ arkada: { enabled: true, campaign: "litvm" } as any, address: "0xabc", chainId: 4441, sign: async () => "0xsig" });
    expect(r).toBeNull();
  });
  it("logs in and extracts token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: "n1" }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: "JWT1" }) } as any);
    const r = await arkadaLogin({
      arkada: { enabled: true, campaign: "litvm", apiBase: "https://api.arkada.gg", nonceRoute: "/auth/nonce", verifyLoginRoute: "/auth/verify" } as any,
      address: "0xabc", chainId: 4441, sign: async () => "0xsig", fetchImpl,
    });
    expect(r?.token).toBe("JWT1");
  });
});
