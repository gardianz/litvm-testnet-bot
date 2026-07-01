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

# 1) FUND wallets first (gas), then 2) run the ecosystem
npm run faucet                     # one-shot: claim 0.1 zkLTC per wallet
npm run bot:live                   # run the ecosystem flows once
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

Configure which run in `config.yaml` `ecosystem.dapps`. See `docs/litvm-live-notes.md`
for every contract address + decoded call.

## Faucet (gas) — `npm run faucet`

Auto-claims the Caldera faucet (**0.1 zkLTC** per fresh wallet). It passes the hub's
Vercel checkpoint with a short headless browser, solves the Cloudflare Turnstile via
2captcha, and calls the `hub.requestFaucetFunds` tRPC. `recipientAddress` is a param —
no wallet connect.

```bash
npm i playwright        # one-time (+ its system libs; present on most VPS)
# .env: CAPTCHA_API_KEY=<2captcha key>
npm run faucet           # claim for all accounts in accounts.json
npm run faucet -- acc3   # one account by id
npm run faucet -- 0xABC… # one raw address
```

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
