# LitVM LiteForge Testnet Bot

Multi-account daily bot for LitVM LiteForge testnet (chainId 4441). Does **real
on-chain actions** on the litVM ecosystem dApps (all live-verified), plus an
auto faucet. Arkada is off by default (its reward claim needs Base-mainnet gas).

## Setup (order matters)

```bash
npm install
npx playwright install chromium   # faucet browser binary
# System libs for chromium are BUNDLED in browser-libs/ and auto-loaded (no sudo).
# If you still hit a lib error, install system-wide: sudo apt install -y libnss3 libnspr4 libasound2
cp config.example.yaml config.yaml
cp .env.example .env               # ACCOUNTS_KEY, CAPTCHA_API_KEY (2captcha), TELEGRAM_*
cp proxy.txt.example proxy.txt     # optional
npm run gen -- 5                   # generate 5 wallets into accounts.json

# Easiest: interactive menu (pick from a list — no commands to memorise)
npm start
```

Or run steps directly:

```bash
# 1) FUND wallets first (gas), then 2) run the ecosystem
npm run faucet                     # one-shot: claim 0.1 zkLTC per wallet
npm run faucet:3h                  # loop: claim every 3h per account (via proxy)
npm run bot:live                   # run the ecosystem flows once
npm run daemon                     # 24/7 live + dashboard
```

Wallets with no gas make every step revert with "insufficient funds" — always
faucet before `bot:live`.

## Ecosystem flows (real on-chain, live-verified)

Per UTC-day (small values, once/daily gated, each tx simulate-guarded):

- **drunkencats** — faucet() all 5 test tokens → swap (native→dcUSDT) → add
  liquidity → open vault (once) → remove liquidity (leave ~10%)
- **onmi** — createToken
- **zns** — gm (daily) + register .lit domain (once)
- **omnihub** — create collection + mint litvm-omnihub (once)
- **litvmswap** — wrap (zkLTC→WzkLTC) → unwrap all
- **aura** — Universal Faucet mint (`withdraw` 0.0001/token) → stake AURA (first-stake task) → buy on
  an open launchpad sale (buy-tokens task) **+ off-chain incentive points**: wallet-sig auth
  (`auth:${addr}`), daily login claim (+20/day → 7-day streak), and auto-verify every open non-social
  task. On-chain tasks (stake/buy/50-txns/streak) clear from real activity. Social tasks
  (X/Discord/Telegram) are OAuth-gated server-side — not API-bypassable, skipped.

Configure which run in `config.yaml` `ecosystem.dapps`. See `docs/litvm-live-notes.md`
for every contract address + decoded call.

## Faucet (gas) — `npm run faucet`

Auto-claims the Caldera faucet (**0.1 zkLTC** per fresh wallet). It passes the hub's
Vercel checkpoint, then **self-solves the Cloudflare Turnstile with `patchright`** (an
undetected Playwright — the hub's own widget auto-issues the token, read from the hidden
`cf-turnstile-response` field), and calls `hub.requestFaucetFunds`. **No 2captcha needed.**
`recipientAddress` is a param — no wallet connect. Each account claims via its own proxy/IP.

patchright must run **headful** (true headless doesn't beat Turnstile). On a desktop/WSLg it
uses your display; on a **headless VPS it auto-wraps with `xvfb-run`** (virtual framebuffer —
no GUI, fully server-side). Install xvfb once: `sudo apt install -y xvfb`. **A GPU-less VPS works**
too — the tool spoofs the WebGL renderer (SwiftShader → a real GPU string) so Turnstile still
self-solves (without it, no-GPU chromium is flagged and the token never appears).

```bash
npm install              # pulls patchright (+ downloads its chromium)
sudo apt install -y xvfb # headless VPS only (desktop/WSLg skips this)
npm run faucet           # claim for all accounts in accounts.json
npm run faucet -- acc3   # one account by id
npm run faucet -- 0xABC… # one raw address
```

`CAPTCHA_API_KEY` (2captcha) is now **optional** — only a fallback if the self-solve token
never populates. `FAUCET_HEADLESS=1` forces true headless (needs the 2captcha fallback).

An address already at the faucet cap/cooldown returns "Failed to send transaction" —
expected; claim per wallet, not repeatedly. Run on demand (not in the daemon loop).
See `docs/litvm-live-notes.md` for the full mechanism.

## Run

```bash
npm run check        # read-only balances + state
npm run bot:dry      # simulate (default)
npm run bot:live     # broadcast
npm run daemon       # 24/7 random daily timing
npm run schedule     # fixed daily cron
npm run verify       # config + chainId sanity
```

Single step / account (debug):

```bash
npx tsx src/main.ts --step arkada-quests --account acc1 --no-dry-run
```

## Safety

- `dryRun: true` default; broadcasting needs `--no-dry-run`.
- Every write asserts chainId 4441.
- `accounts.json`, `config.yaml`, `proxy.txt`, `.env`, `state/`, `logs/` gitignored.

## Scope

register testnet.litvm.com · claim Caldera faucet daily · complete Arkada litvm
quest campaign (on-chain action → verify → claim per quest). No Discord/Twitter.

## Keep alive

```bash
pm2 start "npm run daemon" --name litvm-bot && pm2 save
```

## Test

```bash
npm test
npm run typecheck
```

## Capture calldata from a real browser — `npm run capture`

For dApp flows on unverified contracts (litvmswap LP, lester launchpad) that need
a real wallet connect, open a REAL Chromium window with your MetaMask and capture
the exact calldata, then wire it into the bot.

```bash
# 1) download MetaMask (unpacked): github.com/MetaMask/metamask-extension/releases
#    unzip metamask-chrome-<ver>.zip -> a folder with manifest.json
# 2) needs a display: WSLg/X11 desktop, or on a headless VPS prefix with xvfb-run -a
node tools/capture-browser.mjs https://www.litvmswap.com/swap /path/to/metamask
```

First run: set up MetaMask (import a farming wallet, add LitVM chainId 4441). Then
connect + do the action + approve the popup — every `eth_sendTransaction` prints
here and is saved to `captures.json`. Paste the `{to,data,value}` to wire the flow.
The profile (`.browser-profile/`, holds your wallet) and `tools/metamask/` are gitignored.
