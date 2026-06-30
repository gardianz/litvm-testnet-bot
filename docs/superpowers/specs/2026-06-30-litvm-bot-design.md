# LitVM LiteForge Testnet Bot — Design

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation plan

## Goal

One idempotent, multi-account daily bot for the **LitVM LiteForge testnet**.
Backend-only (no browser / Playwright) — runs on a VPS. Mirrors the architecture
of the sibling `forge` bot (TypeScript + viem, modular `steps/`, idempotent
pipeline, dryRun safety, chainId guard, 2captcha, telegram report).

Tasks that require Discord/Twitter social verification are skipped. If a step
cannot be done purely from the backend, it ships as a skip-with-warning stub
rather than a guessed/broken transaction.

## Chain

| Field | Value |
|-------|-------|
| Network | LiteForge testnet (LitVM) |
| chainId | **4441** |
| RPC | `https://liteforge.rpc.caldera.xyz/infra-partner-http` |
| Native gas | zkLTC |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Faucet | Caldera hub: `https://liteforge.hub.caldera.xyz/` |

EVM-compatible → viem works out of the box.

## Decisions (from brainstorm)

- **Wallets:** generate new (`npm run gen -- N`). Keys stored in gitignored
  `accounts.json` (optionally crypto-js encrypted with `ACCOUNTS_KEY`).
- **Faucet:** claim **daily** (date-gated per UTC day) via Caldera HTTP endpoint;
  solve captcha with **2captcha** (`CAPTCHA_API_KEY`). Also tops up when balance
  < threshold. If the endpoint requires browser/social and cannot be driven from
  the backend, the step warns and skips (user funds manually).
- **Scope (revised):** three things — (1) register testnet.litvm.com, (2) claim
  Caldera faucet daily, (3) complete the **Arkada** quest campaign for litvm
  (`app.arkada.gg/en/quest-campaign/litvm`). Arkada aggregates every ecosystem
  dApp quest (the map nodes: lester, onchaingm, omnihub, multyra, aura, zns, …).
  User confirmed **no social (Discord/Twitter) connect required** — wallet
  signature only.
- **Arkada is NOT skipped** (reverses the earlier decision). The per-dApp steps
  (deploy-token, mints, bridge, check-in) are no longer top-level pipeline steps;
  they become **generic quest-action handlers** invoked by the quest runner.
- **Arkada client = generic** (SIWE login + REST). Endpoints (auth/list/verify/
  claim) are not public → resolved live and pinned into config; unknown quests
  skip with a warning.
- **Quest action = single generic contract-call handler** — `{address, fn, args,
  value}` per quest slug from config. Covers any map node once its call is known.

## Architecture

Clone of the `forge` house pattern. Layout:

```
src/
  main.ts          CLI: --gen --check --bot --dry-run --no-dry-run --daemon --schedule --step --account --no-dashboard
  config.ts        zod-validated config.yaml loader
  accounts.ts      load/decrypt accounts.json (crypto-js, ACCOUNTS_KEY)
  wallet.ts        generate new EVM wallets, derive address
  evm.ts           viem public+wallet client per account (+ proxy), chainId 4441 assert on every write
  proxies.ts       proxy.txt one-per-line, mapped to accounts by index
  state.ts         per-account per-step date-gated state (state/<id>.json)
  runner.ts        per-account pipeline driver: shuffle, accountJitterMs, maxConcurrent, stepDelayMs
  scheduler.ts     node-cron fixed schedule + random daily daemon (minHours..maxHours)
  faucet.ts        Caldera faucet HTTP claim (+ 2captcha)
  captcha.ts       2captcha client (turnstile/recaptcha)
  discover.ts      live contract/endpoint discovery via explorer API
  reporter.ts      telegram + console run summary
  dashboard.ts     TTY live table (auto-off on non-TTY / --no-dashboard)
  quiet.ts         log helpers
  crypto.ts        accounts.json encrypt/decrypt
  balances.ts      per-account zkLTC balance read
  siwe.ts          generic SIWE message builder + sign (shared by register + arkada)
  arkada/
    auth.ts        SIWE login to Arkada -> session token (endpoints from config)
    client.ts      list campaign quests + status, verify(questId), claim(questId)
    actions.ts     generic on-chain contract-call handler ({address,fn,args,value})
    runner.ts      per-quest: action -> verify -> claim -> mark (skip if unknown)
  steps/
    types.ts       Step interface { name, shouldRun(ctx), run(ctx) }
    executor.ts    runs a step: shouldRun -> dryRun simulate | live broadcast -> state write
    register.ts    register testnet.litvm.com (SIWE -> API, discovered live)
    faucet.ts      claim zkLTC daily (Caldera + 2captcha)
    arkada-quests.ts  pipeline step wrapping arkada/runner over the litvm campaign
abis/              erc20.json + generic-call ABIs (added as discovered)
config.yaml        + config.example.yaml
accounts.json      + accounts.example.json (gitignored)
proxy.txt          + proxy.txt.example (gitignored)
.env               + .env.example (ACCOUNTS_KEY, CAPTCHA_API_KEY, TELEGRAM_*)
test/              vitest, mocked clients
docs/litvm-live-notes.md   verified addresses/endpoints + tx hashes
```

## Pipeline

Order (each step idempotent, skip-if-already-done):

```
register -> faucet -> arkada-quests
```

The `arkada-quests` step: SIWE-login to Arkada, fetch the litvm campaign quest
list + per-quest status, then for each incomplete quest run its configured
on-chain action, call Arkada verify, then claim. Daily quests re-run each UTC day;
one-time quests gate on Arkada-reported completion. Unknown quest slugs (no action
mapping or unknown endpoints) skip with a warning — never a guessed tx.

- **register** — once per account (state-gated, not daily). SIWE signature POST.
- **faucet** — **daily** (date-gated per UTC day) + balance-triggered top-up.
- **arkada-quests** — per UTC-day pass over the litvm campaign:
  - Arkada SIWE login (cached session token per account).
  - Fetch quest list + status; filter to incomplete (and daily quests not done today).
  - For each: look up its action mapping in config (`questActions[slug]`). If present,
    run the generic contract-call action (dryRun simulates only). Then POST Arkada
    verify, then claim. Mark in state.
  - No mapping or unknown endpoint → skip with warning.

Every step reads on-chain / Arkada / local state first and **skips when already
done** → runs are resumable and safe to repeat.

## Unknown contracts / endpoints

Arkada's API routes (auth/list/verify/claim) and each quest's on-chain action
(`{address, fn, args, value}`) are **not public**. They are resolved live —
preferably by capturing the SPA network calls — and pinned into `config.yaml`
(`arkada:` endpoints + `questActions:` map) and recorded in
`docs/litvm-live-notes.md`. The bot ships with a **generic** Arkada client and a
**generic** contract-call action; anything not yet mapped **skips with a warning**
— never a guessed transaction. `discover.ts` (explorer ABI/tx helper) assists in
identifying the right contract/selector for a quest.

## Safety

- `dryRun: true` by default. Writes require `--no-dry-run`.
- Every write asserts `chainId === 4441` and refuses any other chain.
- `accounts.json`, `config.yaml`, `proxy.txt`, `.env`, `state/`, `logs/` gitignored.
- Per-account proxy for RPC + faucet/API calls.

## Run

```
npm install
cp config.example.yaml config.yaml
cp .env.example .env
cp accounts.example.json accounts.json   # or: npm run gen -- 5
cp proxy.txt.example proxy.txt           # optional

npm run check         # read-only balances + step state
npm run bot:dry       # simulate
npm run bot:live      # broadcast
npm run daemon        # 24/7 random daily timing
npm run schedule      # fixed daily cron
```

## Testing

- vitest with mocked viem clients per step.
- Tests: chainId-guard refuses non-4441; idempotency (shouldRun false when done);
  faucet date-gating; dryRun never broadcasts.
- `npm run typecheck`.

## Out of scope

- Any quest that genuinely requires Discord/Twitter OAuth (user confirmed the
  litvm campaign needs none; if one appears, skip it with a warning).
- Standalone per-dApp pipeline steps — folded into generic quest-action handlers.
- Explorer "task" (read-only, nothing to automate).
- Browser automation of any kind.
- Mainnet (testnet only; chainId 4441 hard-asserted).
