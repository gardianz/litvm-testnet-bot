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

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
const LOOP = process.argv.includes("--loop");
const FAUCET_STATE = "state/faucet.json";
const loadFaucetState = () => { try { return JSON.parse(readFileSync(FAUCET_STATE, "utf8")); } catch { return {}; } };
const saveFaucetState = (s) => { if (!existsSync("state")) mkdirSync("state", { recursive: true }); writeFileSync(FAUCET_STATE, JSON.stringify(s, null, 2)); };
const rand = (a, b) => a + Math.random() * (b - a);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ userAgent: UA });
const page = await ctx.newPage();

async function ensurePassed() {
  for (let i = 0; i < 5; i++) {
    if ((await page.evaluate(() => document.body.innerText).catch(() => "")).includes("Faucet")) return true;
    await page.goto(HUB, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(12000);
  }
  return (await page.evaluate(() => document.body.innerText).catch(() => "")).includes("Faucet");
}

async function claimOne(addr) {
  if (!(await ensurePassed())) { console.log("  checkpoint not passed"); return false; }
  let token;
  try { token = await solveTurnstile(); } catch (e) { console.log("  captcha fail:", e.message); return false; }
  const r = await page.evaluate(async ({ rollup, addr, token }) => {
    const res = await fetch(`/api/trpc/hub.requestFaucetFunds?batch=1`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ 0: { json: { rollupSubdomain: rollup, recipientAddress: addr, turnstileToken: token } } }),
    });
    return { s: res.status, t: await res.text() };
  }, { rollup: ROLLUP, addr, token });
  let ok = false; try { ok = JSON.parse(r.t)[0].result.data.json.success === true; } catch {}
  console.log(`  ${addr} claim [${r.s}] ${ok ? "OK +0.1" : r.t.slice(0, 120)}`);
  return ok;
}

if (!LOOP) {
  for (const addr of recipients) { console.log(`\n${addr}`); await claimOne(addr); await sleep(4000); }
  await browser.close();
} else {
  // per-address random 1–3h scheduling, persisted across restarts
  console.log(`faucet loop: ${recipients.length} addresses, random 1–3h each`);
  const st = loadFaucetState();
  for (;;) {
    const now = Date.now();
    for (const addr of recipients) {
      const next = st[addr]?.nextTs ?? 0;
      if (now < next) continue;
      console.log(`[${new Date().toISOString()}] claiming ${addr}`);
      await claimOne(addr).catch((e) => console.log("  err", e.message));
      const gapH = rand(1, 3);
      st[addr] = { nextTs: Date.now() + gapH * 3600_000, lastTry: Date.now() };
      saveFaucetState(st);
      console.log(`  next ${addr.slice(0, 10)} in ${gapH.toFixed(2)}h`);
      await sleep(5000);
    }
    await sleep(60_000); // poll every minute
  }
}
