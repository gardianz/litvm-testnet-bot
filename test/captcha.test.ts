import { describe, it, expect, vi } from "vitest";
import { solveTurnstile } from "../src/captcha.js";
const jsonResp = (obj: any) => ({ ok: true, json: async () => obj } as any);

describe("captcha", () => {
  it("submits then polls until token ready", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResp({ status: 1, request: "ID123" }))
      .mockResolvedValueOnce(jsonResp({ status: 0, request: "CAPCHA_NOT_READY" }))
      .mockResolvedValueOnce(jsonResp({ status: 1, request: "TOKEN_XYZ" }));
    const token = await solveTurnstile({ apiKey: "k", sitekey: "s", pageurl: "https://p", fetchImpl, pollMs: 0, maxPolls: 5 });
    expect(token).toBe("TOKEN_XYZ");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("throws on submit error", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResp({ status: 0, request: "ERROR_WRONG_USER_KEY" }));
    await expect(solveTurnstile({ apiKey: "k", sitekey: "s", pageurl: "https://p", fetchImpl })).rejects.toThrow(/ERROR_WRONG_USER_KEY/);
  });
});
