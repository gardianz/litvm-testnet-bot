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

## Arkada — works out of the box

The Arkada API is **live-verified and pre-wired** (`app-api.arkada.gg`): the bot
logs in via wallet signature, lists every `litvm-*` campaign, and claims each
quest. `quest_type=link` quests claim directly; social (X/Discord/Telegram)
quests are skipped. `-daily` campaigns re-run each UTC day. No config needed.

Tune in `config.yaml` under `arkada:` (`campaignPrefix`, `skipSocial`,
`includeDaily`). Verified live: one run claimed 34 litvm quests for a wallet.

### Optional: on-chain quests, faucet, register

- Some quests want a real on-chain tx before Arkada credits them. Map them in
  `questActions[<questId|slug>]` (`address`, `signature`, `args`, `valueWei`) —
  use `npm run discover -- <addr>` to confirm the contract fn. Unmapped on-chain
  quests are reported `unmapped` (no guessed tx).
- Register (`registerApi`) is behind the SPA; capture from the Network tab if you
  want it, else skip (Arkada's litvm-arkada "Verify Wallet" covers the portal need).

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
