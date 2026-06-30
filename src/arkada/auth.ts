import type { Config } from "../config.js";

// Static login message — confirmed live (no nonce). See docs/litvm-live-notes.md.
export const ARKADA_LOGIN_MESSAGE =
  "Welcome to Arkada!\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nIt's needed to authenticate your wallet address.";

type LoginOpts = {
  arkada: Config["arkada"]; address: string;
  sign: (msg: string) => Promise<string>; fetchImpl?: typeof fetch;
};

// POST /auth/signup {address, signature, chainId} -> token at user.accessToken.
// signup is idempotent: returns a fresh token whether or not the account existed.
export async function arkadaLogin(o: LoginOpts): Promise<{ token: string } | null> {
  const a = o.arkada;
  if (!a.apiBase) return null;
  const f = o.fetchImpl ?? fetch;
  const signature = await o.sign(ARKADA_LOGIN_MESSAGE);
  const res = await f(`${a.apiBase}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: JSON.stringify({ address: o.address, signature, chainId: a.signupChainId }),
  });
  if (!res.ok) return null;
  const j: any = await res.json().catch(() => ({}));
  const token = j.user?.accessToken ?? j.accessToken ?? j.token ?? j.data?.accessToken;
  return token ? { token } : null;
}
