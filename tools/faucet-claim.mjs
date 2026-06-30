// Caldera (LiteForge) faucet auto-claimer.
//
// The Caldera hub is gated by a Vercel Security Checkpoint (WASM JS challenge) and
// the faucet is a connect-wallet UI — so it cannot be claimed with plain HTTP.
// This tool drives a headless browser:
//   1. Pass the Vercel checkpoint with a clean context, capture its cookie.
//   2. Reuse the cookie in a context that injects an EIP-6963 wallet bridged to a
//      REAL viem signer (via Playwright exposeFunction — the private key stays in
//      Node, never in the page). Connect, then click the faucet "Request".
//   3. Whatever Request needs — a signature, an on-chain tx, or a drip API call —
//      the bridged provider services it for real.
//
// Requires: playwright installed + its system libs (same as the forge/faucet-pow
// bots already use on the VPS). Run: `node tools/faucet-claim.mjs [accountId]`.
// Keep this OUT of the always-on backend pipeline; run it only when wallets need gas.

import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { chromium } from "playwright";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const HUB = "https://liteforge.hub.caldera.xyz/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const CHAIN_HEX = "0x1159"; // 4441

const cfg = load(readFileSync("config.yaml", "utf8"));
const accounts = JSON.parse(readFileSync("accounts.json", "utf8"));
const wantId = process.argv[2];
const acctRaw = wantId ? accounts.find((a) => a.id === wantId) : accounts[0];
if (!acctRaw) { console.error("account not found"); process.exit(1); }
const account = privateKeyToAccount(acctRaw.pk);
const chain = defineChain({ id: 4441, name: "LiteForge", nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 }, rpcUrls: { default: { http: [cfg.evmRpc] } } });
const pub = createPublicClient({ chain, transport: http(cfg.evmRpc) });
const wal = createWalletClient({ account, chain, transport: http(cfg.evmRpc) });
console.log("faucet-claim for", account.address);

// Real signer bridge — runs in Node, called by the page's injected provider.
async function nodeRpc(method, params = []) {
  try {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [account.address];
    if (method === "eth_chainId") return CHAIN_HEX;
    if (method === "net_version") return "4441";
    if (method === "personal_sign") return wal.signMessage({ account, message: { raw: params[0] } });
    if (method === "eth_sign") return wal.signMessage({ account, message: { raw: params[1] } });
    if (method === "eth_signTypedData_v4") return wal.signTypedData({ account, ...JSON.parse(params[1]) });
    if (method === "eth_sendTransaction") {
      const tx = params[0];
      const hash = await wal.sendTransaction({ account, to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined });
      console.log("  sent tx:", hash);
      return hash;
    }
    if (/wallet_(switch|add|requestPermissions)/.test(method)) return method === "wallet_requestPermissions" ? [{ parentCapability: "eth_accounts" }] : null;
    if (method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
    return await pub.request({ method, params });   // forward everything else to the RPC
  } catch (e) { console.log("  rpc err", method, String(e).slice(0, 80)); return null; }
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"] });

// Phase 1: pass checkpoint clean, grab cookie.
const c1 = await browser.newContext({ userAgent: UA });
const p1 = await c1.newPage();
let ok = false;
for (let i = 0; i < 5 && !ok; i++) {
  await p1.goto(HUB, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await p1.waitForTimeout(12000);
  ok = (await p1.evaluate(() => document.body.innerText).catch(() => "")).includes("Faucet");
  if (!ok) { console.log(`checkpoint retry ${i + 1}`); await p1.waitForTimeout(5000); }
}
const cookies = await c1.cookies();
await c1.close();
if (!ok) { console.error("could not pass Vercel checkpoint"); await browser.close(); process.exit(2); }
console.log("checkpoint passed, cookie:", cookies.map((c) => c.name).join(","));

// Phase 2: cookie + real-wallet provider, connect, Request.
const c2 = await browser.newContext({ userAgent: UA, storageState: { cookies, origins: [] } });
await c2.exposeFunction("__nodeRpc", nodeRpc);
await c2.addInitScript((addr) => {
  const provider = {
    isMetaMask: true, isConnected: () => true, chainId: "0x1159", selectedAddress: addr,
    request: ({ method, params }) => window.__nodeRpc(method, params || []),
    on: () => {}, removeListener: () => {}, removeAllListeners: () => {},
  };
  window.ethereum = provider;
  const info = { uuid: "11111111-1111-1111-1111-111111111111", name: "MetaMask", icon: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", rdns: "io.metamask" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce); announce();
}, account.address);
const p2 = await c2.newPage();
p2.on("response", async (r) => { const u = r.url(); if (/faucet|claim|drip/i.test(u) && !/vercel/.test(u)) { let b = ""; try { b = (await r.text()).slice(0, 300); } catch {} console.log("  faucet resp", r.status(), u, b); } });
await p2.goto(HUB, { waitUntil: "domcontentloaded", timeout: 60000 });
await p2.waitForTimeout(10000);

async function clickAny(re) { for (const loc of [p2.getByRole("button", { name: re }), p2.getByText(re)]) { if (await loc.count()) { await loc.first().click({ timeout: 5000 }).catch(() => {}); return true; } } return false; }
await clickAny(/connect/i); await p2.waitForTimeout(2500);
await clickAny(/metamask/i); await p2.waitForTimeout(4000);
const reqBtn = p2.getByText(/^Request$/).last();
if (await reqBtn.count()) { await reqBtn.click({ timeout: 8000, force: true }).catch((e) => console.log("Request click:", e.message.slice(0, 60))); console.log("Request clicked"); }
else console.log("Request button not found");
await p2.waitForTimeout(15000);

const balAfter = await pub.getBalance({ address: account.address }).catch(() => 0n);
console.log("balance after:", (Number(balAfter) / 1e18).toFixed(6), "zkLTC");
await browser.close();
