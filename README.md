# LitVM LiteForge Testnet Bot

Backend-only, multi-account daily bot for LitVM LiteForge testnet (chainId 4441).
No browser. Pipeline: **register → faucet (daily) → arkada-quests**.

## Setup

```bash
npm install
cp config.example.yaml config.yaml
cp .env.example .env            # ACCOUNTS_KEY, CAPTCHA_API_KEY, TELEGRAM_*
cp proxy.txt.example proxy.txt  # optional
npm run gen -- 5                # generate 5 wallets into accounts.json
```

## Configure live endpoints (one-time)

Arkada/register/faucet APIs aren't public. Capture them from the sites' Network
tab (your own machine) and fill `config.yaml`:

- `registerApi`, `faucetEndpoint`, `faucetSitekey`
- `arkada.apiBase` + routes
- `questActions[<slug>]` per Arkada map node (use `npm run discover -- <addr>`)

Unmapped quests / unset endpoints **skip with a warning** — never a guessed tx.
See `docs/litvm-live-notes.md`.

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
