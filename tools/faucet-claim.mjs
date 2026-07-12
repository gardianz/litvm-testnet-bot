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
import { readFileSync, existsSync as _exists } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
// Bootstrap (re-exec once): (1) bundled chromium libs (libnspr4/libnss3/…) on LD_LIBRARY_PATH
// so chromium + its renderer/gpu subprocesses inherit them; (2) a DISPLAY for headful patchright.
// patchright must run HEADFUL to beat the Turnstile automation check — true headless doesn't
// auto-solve. On a headless VPS we auto-wrap with `xvfb-run` (virtual framebuffer: no GUI, still
// fully server-side). WSLg/desktop already has DISPLAY, so it runs headful directly.
const _libDir = join(dirname(fileURLToPath(import.meta.url)), "..", "browser-libs");
const _needLib = _exists(_libDir) && !(process.env.LD_LIBRARY_PATH || "").split(":").includes(_libDir);
const _needXvfb = process.env.FAUCET_HEADLESS !== "1" && !process.env.DISPLAY && !process.env.__XVFB
  && spawnSync("sh", ["-c", "command -v xvfb-run"]).status === 0;
if (_needLib || _needXvfb) {
  const env = { ...process.env, LD_LIBRARY_PATH: `${_libDir}:${process.env.LD_LIBRARY_PATH || ""}`, __XVFB: "1" };
  const node = [process.execPath, ...process.argv.slice(1)];
  const r = _needXvfb
    ? spawnSync("xvfb-run", ["-a", "--server-args=-screen 0 1280x1024x24", ...node], { stdio: "inherit", env })
    : spawnSync(node[0], node.slice(1), { stdio: "inherit", env });
  process.exit(r.status ?? 0);
}
import "dotenv/config";
import { load } from "js-yaml";
// patchright = undetected playwright. It defeats the Turnstile automation check, so the hub's
// OWN widget auto-issues a token (read from the hidden cf-turnstile-response input) — NO 2captcha.
// Requires a real display: works headful on WSLg/desktop; on a headless VPS wrap with `xvfb-run -a`.
import { chromium } from "patchright";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { createPublicClient, http, defineChain, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const HUB = "https://liteforge.hub.caldera.xyz/";
const SITEKEY = "0x4AAAAAAASRorjU_k9HAdVc";
const ROLLUP = "liteforge";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const cfg = load(readFileSync("config.yaml", "utf8"));
const apiKey = process.env.CAPTCHA_API_KEY;   // optional now — only a fallback if self-solve fails
// patchright needs a real display: default headful; VPS → `xvfb-run -a`. FAUCET_HEADLESS=1 to force.
const HEADLESS = process.env.FAUCET_HEADLESS === "1";

// proxy.txt (one per line, mapped to accounts by index) — each account claims via its own proxy
function loadProxies(path) {
  if (!_exists(path)) return [];
  return readFileSync(path, "utf8").split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => (/^(https?|socks\d?):\/\//.test(l) ? l : `http://${l}`));
}
// playwright proxy object from a proxy URL (http://user:pass@host:port / socks5://…)
function parseProxy(str) {
  if (!str) return undefined;
  try {
    const u = new URL(str);
    const server = `${u.protocol}//${u.host}`;
    return u.username ? { server, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } : { server };
  } catch { return undefined; }
}

// resolve entries [{address, proxy}]: arg = accountId or 0xaddr; default = all accounts.
// pick the first POSITIONAL arg (skip --loop / --hours <n> flags).
const _argv = process.argv.slice(2);
const arg = _argv.find((a, i) => !a.startsWith("--") && _argv[i - 1] !== "--hours");
const allAccounts = JSON.parse(readFileSync("accounts.json", "utf8"));
const proxyList = loadProxies(cfg.proxyFile || "proxy.txt");
let entries;
if (arg && isAddress(arg)) {
  entries = [{ address: arg, proxy: undefined }];
} else {
  const picked = arg ? allAccounts.filter((a) => a.id === arg) : allAccounts;
  entries = picked.map((a) => {
    const idx = allAccounts.indexOf(a);
    return { address: privateKeyToAccount(a.pk).address, proxy: parseProxy(a.proxy || proxyList[idx]) };
  });
}
if (!entries.length) { console.error("no recipients"); process.exit(1); }

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
// fixed interval hours (e.g. --hours 3); default = random 1–3h per address
const _hIdx = process.argv.indexOf("--hours");
const FIXED_HOURS = _hIdx >= 0 ? Number(process.argv[_hIdx + 1]) : undefined;
const FAUCET_STATE = "state/faucet.json";
const loadFaucetState = () => { try { return JSON.parse(readFileSync(FAUCET_STATE, "utf8")); } catch { return {}; } };
const saveFaucetState = (s) => { if (!existsSync("state")) mkdirSync("state", { recursive: true }); writeFileSync(FAUCET_STATE, JSON.stringify(s, null, 2)); };
const rand = (a, b) => a + Math.random() * (b - a);

// patchright runs headful (bootstrap gave it a display: WSLg's, or an auto-xvfb one on a VPS).
let activeCtx = null;
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { activeCtx?.close().catch(() => {}).finally(() => process.exit(0)); });

async function ensurePassed(page) {
  for (let i = 0; i < 5; i++) {
    if ((await page.evaluate(() => document.body.innerText).catch(() => "")).includes("Faucet")) return true;
    await page.goto(HUB, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(12000);
  }
  return (await page.evaluate(() => document.body.innerText).catch(() => "")).includes("Faucet");
}

// read the hub's OWN auto-issued Turnstile token from the hidden cf-turnstile-response input.
// patchright makes the managed widget self-solve, so this needs no 2captcha. Poll until populated.
async function readSelfSolvedToken(page, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await page.evaluate(() => document.querySelector('input[name="cf-turnstile-response"]')?.value || "").catch(() => "");
    if (v && v.length > 20) return v;
    await page.waitForTimeout(2000);
  }
  return "";
}

// low-RAM flags that DON'T touch GPU/WebGL/process-model (those are Turnstile-fingerprinted —
// --disable-gpu / --renderer-process-limit=1 can break the self-solve, so they're left out).
const MEM_FLAGS = [
  "--no-sandbox", "--disable-dev-shm-usage",
  "--js-flags=--max-old-space-size=512", // cap V8 heap per process
  "--disable-extensions", "--disable-background-networking", "--disable-component-update",
  "--disable-features=Translate,BackForwardCache,MediaRouter,OptimizationHints",
  "--mute-audio",
];
// each account claims in its OWN patchright persistent context (own proxy/IP + fresh profile).
async function claimEntry(entry) {
  const profile = join(tmpdir(), `pr-${entry.address.slice(2, 10)}-${Date.now()}`);
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: HEADLESS, viewport: null,
    args: MEM_FLAGS,
    ...(entry.proxy ? { proxy: entry.proxy } : {}),
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ":0" },
  });
  activeCtx = ctx;
  // WebGL renderer spoof — REQUIRED on a GPU-less VPS. With no GPU, chromium falls back to
  // SwiftShader, and Turnstile flags the "SwiftShader" renderer string as a bot → the widget
  // won't self-solve. Report a common real GPU instead (verified: flips the self-solve on).
  // patchright runs page.evaluate in an isolated world, so this main-world patch is invisible to
  // our own reads but seen by Turnstile's main-world JS — exactly what we want.
  await ctx.addInitScript(() => {
    for (const P of [self.WebGLRenderingContext, self.WebGL2RenderingContext]) {
      if (!P) continue;
      const gp = P.prototype.getParameter;
      P.prototype.getParameter = function (p) {
        if (p === 37445) return "Intel Inc.";                                                             // UNMASKED_VENDOR_WEBGL
        if (p === 37446) return "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)"; // UNMASKED_RENDERER_WEBGL
        return gp.call(this, p);
      };
    }
  });
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    if (!(await ensurePassed(page))) { console.log(`  ${entry.address} checkpoint not passed`); return false; }
    // free self-solve first; fall back to 2captcha only if it never populates AND a key is set.
    let token = await readSelfSolvedToken(page), via = "self-solve";
    if (!token && apiKey) { try { token = await solveTurnstile(); via = "2captcha"; } catch (e) { console.log("  captcha fail:", e.message); return false; } }
    if (!token) { console.log(`  ${entry.address} no turnstile token (needs a display/xvfb, or set CAPTCHA_API_KEY)`); return false; }
    const r = await page.evaluate(async ({ rollup, addr, token }) => {
      const res = await fetch(`/api/trpc/hub.requestFaucetFunds?batch=1`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ 0: { json: { rollupSubdomain: rollup, recipientAddress: addr, turnstileToken: token } } }),
      });
      return { s: res.status, t: await res.text() };
    }, { rollup: ROLLUP, addr: entry.address, token });
    let ok = false; try { ok = JSON.parse(r.t)[0].result.data.json.success === true; } catch {}
    console.log(`  ${entry.address} ${entry.proxy ? "[proxy]" : "[no-proxy]"} [${via}] claim [${r.s}] ${ok ? "OK +0.1" : r.t.slice(0, 120)}`);
    return ok;
  } finally { await ctx.close().catch(() => {}); activeCtx = null; try { rmSync(profile, { recursive: true, force: true }); } catch {} }
}

if (!LOOP) {
  for (const e of entries) { console.log(`\n${e.address}`); await claimEntry(e).catch((err) => console.log("  err", err.message)); await sleep(4000); }
} else {
  // per-address random 1–3h scheduling, persisted across restarts, each via its own proxy
  console.log(`faucet loop: ${entries.length} addresses, ${FIXED_HOURS ? `every ${FIXED_HOURS}h` : "random 1–3h"} each${proxyList.length ? " (per-account proxy)" : ""}`);
  const st = loadFaucetState();
  for (;;) {
    const now = Date.now();
    for (const e of entries) {
      const next = st[e.address]?.nextTs ?? 0;
      if (now < next) continue;
      console.log(`[${new Date().toISOString()}] claiming ${e.address}`);
      await claimEntry(e).catch((err) => console.log("  err", err.message));
      const gapH = FIXED_HOURS ?? rand(1, 3);
      st[e.address] = { nextTs: Date.now() + gapH * 3600_000, lastTry: Date.now() };
      saveFaucetState(st);
      console.log(`  next ${e.address.slice(0, 10)} in ${gapH.toFixed(2)}h`);
      await sleep(5000);
    }
    await sleep(60_000); // poll every minute
  }
}
