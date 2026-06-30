import type { Config } from "../config.js";
import { buildSiweMessage } from "../siwe.js";

type LoginOpts = {
  arkada: Config["arkada"]; address: string; chainId: number;
  sign: (msg: string) => Promise<string>; fetchImpl?: typeof fetch;
};

export async function arkadaLogin(o: LoginOpts): Promise<{ token: string } | null> {
  const a = o.arkada;
  if (!a.apiBase || !a.nonceRoute || !a.verifyLoginRoute) return null;
  const f = o.fetchImpl ?? fetch;
  const nonceRes: any = await (await f(`${a.apiBase}${a.nonceRoute}?address=${o.address}`)).json().catch(() => ({}));
  const nonce = nonceRes.nonce ?? nonceRes.data?.nonce;
  if (!nonce) return null;
  const message = buildSiweMessage({
    domain: "app.arkada.gg", address: o.address, statement: "Sign in to Arkada.",
    uri: "https://app.arkada.gg", nonce, chainId: o.chainId,
  });
  const signature = await o.sign(message);
  const res = await f(`${a.apiBase}${a.verifyLoginRoute}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: o.address, message, signature }),
  });
  if (!res.ok) return null;
  const j: any = await res.json().catch(() => ({}));
  const token = j.token ?? j.accessToken ?? j.jwt ?? j.data?.token;
  return token ? { token } : null;
}
