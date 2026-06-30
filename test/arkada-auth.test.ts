import { describe, it, expect, vi } from "vitest";
import { arkadaLogin, ARKADA_LOGIN_MESSAGE } from "../src/arkada/auth.js";

describe("arkadaLogin", () => {
  it("returns null when apiBase unset", async () => {
    const r = await arkadaLogin({ arkada: { enabled: true } as any, address: "0xabc", sign: async () => "0xsig" });
    expect(r).toBeNull();
  });
  it("signs static message, posts signup, extracts user.accessToken", async () => {
    const sign = vi.fn(async () => "0xsig");
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ user: { accessToken: "JWT1" } }) } as any);
    const r = await arkadaLogin({
      arkada: { enabled: true, apiBase: "https://app-api.arkada.gg", signupChainId: 4441 } as any,
      address: "0xabc", sign, fetchImpl,
    });
    expect(sign).toHaveBeenCalledWith(ARKADA_LOGIN_MESSAGE);
    expect(fetchImpl.mock.calls[0][0]).toContain("/auth/signup");
    expect(r?.token).toBe("JWT1");
  });
});
