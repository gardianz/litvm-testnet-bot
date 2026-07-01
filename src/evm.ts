import { createPublicClient, createWalletClient, http, defineChain, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fetch as undiciFetch } from "undici";
import { CHAIN_ID, type Config } from "./config.js";
import type { Account } from "./accounts.js";
import { dispatcherFor } from "./proxies.js";

// viem's http transport uses global fetch. Node's built-in fetch is a *different*
// undici build than the npm `undici` whose ProxyAgent we use for per-account proxies
// — mixing them throws "invalid onRequestStart method". Align global fetch to the
// same undici so `fetchOptions.dispatcher` (ProxyAgent) works.
(globalThis as any).fetch = undiciFetch;

export function defineLiteforge(rpc: string) {
  return defineChain({
    id: CHAIN_ID,
    name: "LiteForge",
    nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
}

export function makeClients(cfg: Config, acc: Account) {
  const chain = defineLiteforge(cfg.evmRpc);
  const account = privateKeyToAccount(acc.pk);
  const dispatcher = cfg.proxyRpc ? dispatcherFor(acc.proxy) : undefined;
  const transport = http(cfg.evmRpc, dispatcher ? { fetchOptions: { dispatcher } as any } : {});
  return {
    public: createPublicClient({ chain, transport }) as PublicClient,
    wallet: createWalletClient({ account, chain, transport }) as WalletClient,
    address: account.address,
  };
}

export async function assertChain(client: Pick<PublicClient, "getChainId">): Promise<void> {
  const id = await client.getChainId();
  if (id !== CHAIN_ID) throw new Error(`refusing: connected to chain ${id}, expected ${CHAIN_ID}`);
}
