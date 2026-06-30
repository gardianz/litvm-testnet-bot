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
- **Scope:** register, faucet, deploy-token (lester-labs), onchaingm badge,
  OmniHub mint, Multyra bridge, Aura Protocol. **Arkada skipped** (social-gated).

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
  steps/
    types.ts       Step interface { name, shouldRun(ctx), run(ctx) }
    executor.ts    runs a step: shouldRun -> dryRun simulate | live broadcast -> state write
    register.ts    task1: SIWE-style signature -> testnet.litvm.com API (discovered live)
    faucet.ts      task2: claim zkLTC daily (2captcha)
    deploy-token.ts task4: lester-labs Token Factory deploy (0.05 zkLTC)
    onchaingm.ts   task3: claim LitVM badge mint
    omnihub.ts     mint litvm-testnet NFT collection
    multyra.ts     bridge zkLTC LiteForge<->Ethereum + test transfer
    aura.ts        daily check-in / stake / vote (beta.auralaunch.org)
abis/              erc20.json + per-contract ABIs (added as discovered)
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
register -> faucet -> deploy-token -> onchaingm -> omnihub -> multyra -> aura
```

- **register** — once per account (state-gated, not daily). SIWE signature POST.
- **faucet** — **daily** (date-gated per UTC day) + balance-triggered top-up.
- **deploy-token** — daily (one token/day) or once, configurable.
- **onchaingm / omnihub** — claim/mint once if not already held (read on-chain first).
- **multyra** — bridge/transfer, gated by balance + cooldown.
- **aura** — daily check-in always; stake/vote configurable.

Every step reads on-chain or local state first and **skips when already done** →
runs are resumable and safe to repeat.

## Unknown contracts / endpoints

Contract addresses and API routes for register, lester-labs factory, onchaingm,
omnihub, multyra, aura are **not public**. `discover.ts` resolves them live from
the explorer API (verified contracts + recent tx decode) during implementation.
Confirmed values are pinned into `config.yaml` and recorded in
`docs/litvm-live-notes.md` with tx hashes (same "verified live" model as forge).
Anything that cannot be verified ships as a **skip-with-warning stub** — never a
guessed transaction.

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

- Arkada quests (Discord/Twitter verification).
- Explorer "task" (read-only, nothing to automate).
- Browser automation of any kind.
- Mainnet (testnet only; chainId 4441 hard-asserted).
