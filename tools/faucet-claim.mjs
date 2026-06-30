// Caldera (LiteForge) faucet auto-claimer — mostly backend.
//
// The Caldera hub is gated by a Vercel Security Checkpoint (WASM JS challenge), and
// the faucet tRPC requires a Cloudflare Turnstile token. Flow (verified live):
//   1. A short headless browser passes the Vercel checkpoint (clean context — no
//      stealth/init tampering, realistic UA, single navigation).
//   2. Solve the Turnstile (sitekey 0x4AAAAAAASRorjU_k9HAdVc) via 2captcha.
//   3. In-page fetch the tRPC mutation (must run inside the passed browser context;
//      a plain Node HTTP client is re-challenged by Vercel TLS fingerprinting):
//        POST /api/trpc/hub.requestFaucetFunds?batch=1
//        body {"0":{"json":{ rollupSubdomain, recipientAddress, turnstileToken }}}
//   recipientAddress is a parameter — NO wallet connect needed; claims for any address.
//
// Requires: playwright (+ system libs, as the forge/faucet-pow bots use) and a
// 2captcha key in CAPTCHA_API_KEY. Run on demand: `node tools/faucet-claim.mjs [accountId|0xaddr]`.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { chromium } from "playwright";
import { createPublicClient, http, defineChain, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const HUB = "https://liteforge.hub.caldera.xyz/";
const SITEKEY = "0x4AAAAAAASRorjU_k9HAdVc";
const ROLLUP = "liteforge";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const cfg = load(readFileSync("config.yaml", "utf8"));
const apiKey = process.env.CAPTCHA_API_KEY;
if (!apiKey) { console.error("CAPTCHA_API_KEY unset (.env)"); process.exit(1); }

// resolve recipient list: arg = accountId or 0xaddr; default = all accounts
const arg = process.argv[2];
let recipients;
if (arg && isAddress(arg)) recipients = [arg];
else {
  const accounts = JSON.parse(readFileSync("accounts.json", "utf8"));
  const picked = arg ? accounts.filter((a) => a.id === arg) : accounts;
  recipients = picked.map((a) => privateKeyToAccount(a.pk).address);
}
if (!recipients.length) { console.error("no recipients"); process.exit(1); }

const chain = defineChain({ id: 4441, name: "LiteForge", nativeCurrency: { name: "zkLTC", symbol: "zkLTC", decimals: 18 }, rpcUrls: { default: { http: [cfg.evmRpc] } } });
const pub = createPublicClient({ chain, transport: http(cfg.evmRpc) });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function solveTurnstile() {
  const sub = await (await fetch(`https://2captcha.com/in.php?key=${apiKey}&method=turnstile&sitekey=${SITEKEY}&pageurl=${encodeURIComponent(HUB)}&json=1`)).json();
  if (sub.status !== 1) throw new Error("2captcha submit: " + sub.request);
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const res = await (await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${sub.request}&json=1`)).json();
    if (res.status === 1) return res.request;
    if (res.request !== "CAPCHA_NOT_READY") throw new Error("2captcha poll: " + res.request);
  }
  throw new Error("2captcha timeout");
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ userAgent: UA });
const page = await ctx.newPage();
let passed = false;
for (let i = 0; i < 5 && !passed; i++) {
  await page.goto(HUB, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(12000);
  passed = (await page.evaluate(() => document.body.innerText).catch(() => "")).includes("Faucet");
  if (!passed) { console.log(`checkpoint retry ${i + 1}`); await page.waitForTimeout(5000); }
}
if (!passed) { console.error("could not pass Vercel checkpoint"); await browser.close(); process.exit(2); }
console.log("checkpoint passed");

for (const addr of recipients) {
  const before = await pub.getBalance({ address: addr }).catch(() => 0n);
  console.log(`\n${addr}  before=${(Number(before) / 1e18).toFixed(6)} zkLTC`);
  let token;
  try { console.log("  solving turnstile..."); token = await solveTurnstile(); } catch (e) { console.log("  captcha fail:", e.message); continue; }
  const r = await page.evaluate(async ({ rollup, addr, token }) => {
    const res = await fetch(`/api/trpc/hub.requestFaucetFunds?batch=1`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ 0: { json: { rollupSubdomain: rollup, recipientAddress: addr, turnstileToken: token } } }),
    });
    return { s: res.status, t: await res.text() };
  }, { rollup: ROLLUP, addr, token });
  let msg = r.t;
  try { msg = JSON.stringify(JSON.parse(r.t)[0].result.data.json); } catch {}
  console.log(`  claim [${r.s}] ${msg.slice(0, 200)}`);
  await sleep(6000);
  const after = await pub.getBalance({ address: addr }).catch(() => before);
  console.log(`  after=${(Number(after) / 1e18).toFixed(6)} zkLTC (+${(Number(after - before) / 1e18).toFixed(6)})`);
}
await browser.close();
