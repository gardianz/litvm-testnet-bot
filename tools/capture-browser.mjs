// Real controllable browser (headful) with your MetaMask extension, for capturing
// the exact on-chain calldata a dApp sends — so its flow can be wired into the bot.
//
//   node tools/capture-browser.mjs <dappUrl> [extensionPath]
//
// - Opens a REAL Chromium window (needs a display: WSLg/X11; on a headless VPS use
//   `xvfb-run -a node tools/capture-browser.mjs …`).
// - Loads an UNPACKED MetaMask extension (download+unzip it yourself; default path
//   ./tools/metamask, or pass the path / set METAMASK_PATH).
// - Persistent profile (./.browser-profile) so your MetaMask import + Google login
//   persist across runs. YOU interact (import wallet, connect, approve popups).
// - Wraps window.ethereum.request → logs every eth_sendTransaction {to,data,value}
//   to the console and appends to captures.json. Paste those to wire the flow.
//
// The profile holds your wallet — ./.browser-profile and ./tools/metamask are gitignored.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, appendFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const LIB = join(ROOT, "browser-libs");

const url = process.argv[2] || "https://www.litvmswap.com/swap";
const extPath = resolve(process.argv[3] || process.env.METAMASK_PATH || join(HERE, "metamask"));
if (!existsSync(join(extPath, "manifest.json"))) {
  console.error(`MetaMask not found at ${extPath}\nDownload the extension zip from github.com/MetaMask/metamask-extension/releases,\nunzip it, and pass the folder: node tools/capture-browser.mjs <url> <unzipped-folder>`);
  process.exit(1);
}

const profile = join(ROOT, ".browser-profile");
const capFile = join(ROOT, "captures.json");

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  channel: undefined,
  viewport: null,
  args: [
    "--no-sandbox", "--disable-dev-shm-usage",
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
  env: { ...process.env, LD_LIBRARY_PATH: `${LIB}:${process.env.LD_LIBRARY_PATH || ""}`, DISPLAY: process.env.DISPLAY || ":0" },
});

// node-side sink: print + persist captured txs
await ctx.exposeBinding("__cap", (_src, txJson) => {
  const line = `[${new Date().toISOString()}] eth_sendTransaction ${txJson}`;
  console.log("\n>>> CAPTURED " + line + "\n");
  try { appendFileSync(capFile, line + "\n"); } catch {}
});

// wrap window.ethereum.request on every page/frame once MetaMask injects it
await ctx.addInitScript(() => {
  const wrap = () => {
    const eth = window.ethereum;
    if (eth && !eth.__capWrapped && typeof eth.request === "function") {
      const orig = eth.request.bind(eth);
      eth.request = async (args) => {
        try { if (args && args.method === "eth_sendTransaction" && args.params && args.params[0]) window.__cap(JSON.stringify(args.params[0])); } catch {}
        return orig(args);
      };
      eth.__capWrapped = true;
    }
  };
  wrap();
  setInterval(wrap, 300);
});

const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
console.log(`\nReal browser open at ${url}`);
console.log("1) First run: set up MetaMask (import a farming wallet, add LitVM network chainId 4441).");
console.log("2) Connect wallet, do the dApp action, approve the MetaMask popup.");
console.log("3) The calldata prints here + saves to captures.json. Ctrl+C when done.\n");

for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { ctx.close().catch(() => {}).finally(() => process.exit(0)); });
// keep alive
await new Promise(() => {});
