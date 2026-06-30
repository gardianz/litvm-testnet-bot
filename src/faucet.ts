import { solveTurnstile } from "./captcha.js";

type ClaimOpts = { faucetUrl: string; address: string; endpoint?: string; apiKey?: string; sitekey?: string; fetchImpl?: typeof fetch };

export async function claimFaucet(o: ClaimOpts): Promise<{ ok: boolean; reason?: string; tx?: string }> {
  if (!o.endpoint) return { ok: false, reason: "no-endpoint" };
  const f = o.fetchImpl ?? fetch;
  let token: string | undefined;
  if (o.sitekey) {
    if (!o.apiKey) return { ok: false, reason: "no-captcha-key" };
    token = await solveTurnstile({ apiKey: o.apiKey, sitekey: o.sitekey, pageurl: o.faucetUrl, fetchImpl: f });
  }
  const res = await f(o.endpoint, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: o.address, ...(token ? { token, "cf-turnstile-response": token } : {}) }),
  });
  if (!res.ok) return { ok: false, reason: `http-${res.status}` };
  const j: any = await res.json().catch(() => ({}));
  if (j.success === false || j.error) return { ok: false, reason: j.error ?? "rejected" };
  return { ok: true, tx: j.txHash ?? j.tx ?? undefined };
}
