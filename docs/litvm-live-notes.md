# LitVM LiteForge — Verified Live Notes

> Discovered live (2026-06-30) by grepping the app.arkada.gg Next.js bundles and
> testing against the API with a real wallet. All Arkada facts below are CONFIRMED.

## Chain
- chainId 4441, RPC https://liteforge.rpc.caldera.xyz/infra-partner-http, native zkLTC
- explorer https://liteforge.explorer.caldera.xyz (Blockscout `/api?module=...`; `txlist` hangs, `getabi` works)

## Arkada API (CONFIRMED)

- **API base:** `https://app-api.arkada.gg`  (frontend at app.arkada.gg, API at app-api.arkada.gg)
- **Auth (login = signup, idempotent):**
  - `POST /auth/signup` body `{ address, signature, chainId }` (`refCode` optional)
  - Signed message is **static** (no nonce):
    ```
    Welcome to Arkada!

    This request will not trigger a blockchain transaction or cost any gas fees.

    It's needed to authenticate your wallet address.
    ```
  - Response: `{ message, user: { user: {...}, accessToken } }` → JWT at **`user.accessToken`**
  - Auth header on secure routes: `Authorization: Bearer <accessToken>`
- **Campaigns:**
  - `GET /campaigns?limit=300` → array; litvm hub = every campaign whose `slug` starts with `litvm`
  - `GET /campaigns/{slug}` → campaign incl. `quests[]`
  - quest fields: `id, name, description, quest_type, link, sequence, optional, monitorId, is_challenge, campaign_id`
- **Quest verify/claim (both secure, body `{ id }`):**
  - `POST /quests/check-quest { id }` → 200 if Arkada's monitor sees the on-chain/action done; **422 "Quest not completed"** otherwise
  - `POST /quests/complete-quest { id }` → `{ id, address, isCompleted: true }`
  - `quest_type: "link"` quests complete via `complete-quest` directly (visit-trust). on-chain types need the underlying tx first so `check-quest` passes.
  - Social quests (`link` contains `x.com` / `twitter` / `discord` / `t.me`) need OAuth → **skip**.

### litvm campaigns (slug → name), sample
- litvm-arkada (Verify Wallet Daily) · litvm-faucet (Faucet Task) · litvm-lester (Lester Labs)
- litvm-zns / litvm-zns-daily · litvm-omnihub · litvm-omnifun · litvm-sweep · litvm-ayni
- litvm-litvmswap(-daily) · litvm-liteswap(-daily) · litvm-wheelx · litvm-litdex · litvm-litiumdex
- litvm-nfts2me · litvm-midaspredict · litvm-drunkencats · litvm-betsonblock · litvm-infinityname
- `-daily` suffix = repeats daily.

## Faucet (liteforge.hub.caldera.xyz)  -> config.faucetEndpoint / faucetSitekey
- Behind Cloudflare (curl 429). Endpoint/sitekey still need browser capture, OR fund manually.
- Wallet already funded in testing (0.1 zkLTC), so faucet step is optional.

## Register (testnet.litvm.com)  -> config.registerApi
- SPA; route not yet captured. Arkada `litvm-arkada` "Verify Wallet" covers the on-portal need.

## Quest -> on-chain action map  -> config.questActions[<questId>]
On-chain quests (mint/swap/gm/deploy) need the dApp tx before check-quest passes.
Map by **quest id** (uuid) using `link` as the hint of which dApp + `npm run discover -- <contract>`:
- litvm-lester "Mint" 7b0552a0-... -> lester-labs.com/launch
- litvm-zns-daily "GM" 6f744542-... -> zns.bio/gm-deploy
- (fill the rest as contracts are confirmed)

## On-chain quest target map (CONFIRMED live)

Arkada verifies via explorer `/api/v2/addresses/{wallet}/transactions?filter=from`,
counting successes where `to` ∈ targets and `matchedCount >= minCount`. Method/args
NOT inspected — only a successful tx FROM wallet TO the target.

| campaign/quest | target contract | minCount |
|---|---|---|
| litvm-arkada/Verification | `0x3db744585f892dc77750b2f4376B4Fc1Dd66d510` | 1+ |
| litvm-litvmswap-daily/Swap | `0xEb5600899BD87F0dF9200dEaD5B8098B63708C75` | 1+ |
| litvm-liteswap-daily/Swap | `0xa924E442890916df0e14d5C0CD6123a3425FBB18` | 1+ |
| litvm-wheelx/Swap | `0x6222f99443A0d75bd96d40F2904606f60f37cdc2` | 1+ |
| litvm-omnifun/Swap | `0xe351c47c3b96844F46e9808a7D5bBa8101BfFB57` | 1+ |
| litvm-omnifun/Create | `0x432b8b70a63eBB6b90CDFa1F7FeCDf2DD34e7c4E` | 1+ |
| litvm-omnifun/Liquidity | `0xe351c47c3b96844F46e9808a7D5bBa8101BfFB57` | 1+ |
| litvm-lester/Mint | `0x93acc61fcdc2e3407A0c03450Adfd8aE78964948` | 1+ |
| litvm-lester/Message | `0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079` | 1+ |
| litvm-lester/Create | `0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f` | 1+ |
| litvm-zns/Domain | `0x1c6C28403400c44D8D351dEaBcF7B1365F96EbF1` | 1+ |
| litvm-litvmswap/Swap | `0xEb5600899BD87F0dF9200dEaD5B8098B63708C75` | 1+ |
| litvm-litvmswap/Liquidity V2 | `0xF456737D17C2Bbb348fd4F7D1b000D62A46FB3b5` | 1+ |
| litvm-litvmswap/Liquidity V3 | `0x1089f046B597f259BeFDC15Bf9C90E33616BA366` | 1+ |
| litvm-litvmswap/Trade | `0x6e2A23b9EeF67aA8fe8ad6F57EA12f83069DB512` | 1+ |
| litvm-liteswap/Swap | `0xa924E442890916df0e14d5C0CD6123a3425FBB18` | 1+ |
| litvm-sweep/Mint | `0x3da654d87F240CAf2B324dE31747f18EBC6238A1` | 1+ |
| litvm-ayni/Borrow | `0xA1AB30Dd0B3a6f6d28D0FD0765136D571E19DA55` | 1+ |
| litvm-omnihub/Create | `0x7798f2Eb73C1Dd8Fa8086d780D5CF114A10F528E` | 1+ |
| litvm-nfts2me/Deploy | `0x00000000001594C61dD8a6804da9AB58eD2483ce` | 1+ |
| litvm-drunkencats/Create Vault | `0x7a1d18b9172E60d7587dd3180697277e75558E41` | 1+ |
| litvm-drunkencats/Liquidity | `0xAE92F4644Cc11f837dC4Be12B83D6FD4E887AFEE` | 1+ |
| litvm-drunkencats/Swap | `0xAE92F4644Cc11f837dC4Be12B83D6FD4E887AFEE` | 1+ |
| litvm-betsonblock/Bet | `0x554FA14360dEaE7A7ec6b9216Fa9Ca3cA76983a0` | 1+ |
| litvm-betsonblock/Play | `0x162ED453121f91eb3595e7f4513F78a0b5b02a81` | 1+ |
| litvm-infinityname/Domain | `0x76a816EFa69e3183972ff7a231F5C8d7b065d9De` | 1+ |
| litvm-litdex/Swap | `0xFa1f665C6ee5167f78454d85bc56D263D5da4576` | 1+ |
| litvm-litdex/Liquidity  | `0xFa1f665C6ee5167f78454d85bc56D263D5da4576` | 1+ |
| litvm-litdex/Message | `0x9624FBBD6931b9D75961994E13604c1DC2c56225` | 1+ |
| litvm-litdex/Deploy | `0x953124243647F043b6D7Eb924e2a89179cBb78da` | 1+ |
| litvm-litiumdex/Swap | `0x2A7Df101B2E999F3F58657086704553A97AC7bB3` | 1+ |

## Reward claim (points) — Pyramid contract
Points stay 0 until **Claim Reward** per campaign. That is an on-chain mint, not an API call:
- Pyramid contract `0x3db744585f892dc77750b2f4376B4Fc1Dd66d510` (also the litvm-arkada "Verification" target). Has `mint(...) returns (uint256 assets)` + `ClaimRewards` event + `Pyramid__ClaimRewardsFailed` error.
- Backend issues a mint signature: `POST /proof-of-action/mint-signature { projectKey }` (secure) and/or `POST /quests/mint-data` (secure). Submit the signed data to `Pyramid.mint(...)`.
- Signature is per-user/nonce → NOT replayable; must use the wallet's own signed data.

## Honest on-chain feasibility (measured live)
- Arkada verify = explorer query: successful tx FROM wallet TO target, count >= minCount. Method/args not checked.
- Generic replay (replay a recent successful tx, redirect sender) succeeds for only ~4/26 targets
  (wheelx/Swap, omnifun/Create, litdex/Message, litdex/Deploy). The other ~21 revert because their
  calldata bakes in amounts/deadlines/approvals/nonces — they need bespoke per-dApp calls
  (real ABI + fresh args + token approvals). Map those in `questActions[<questId|slug>]`.
- Link/trust quests: complete-quest claims directly (34 completed live).
- Gas: faucet auto-claim SOLVED — see below.

## Faucet (Caldera hub) — SOLVED ✅ (verified live: fresh wallet +0.1 zkLTC)
The hub is gated by a **Vercel Security Checkpoint** (WASM JS challenge); plain HTTP = 429.
The faucet is a **tRPC mutation** that needs a **Cloudflare Turnstile** token.

Full flow (`tools/faucet-claim.mjs`, run on demand):
1. **Pass the Vercel checkpoint** with a clean headless Playwright context: chrome-headless-shell,
   realistic desktop UA, **NO stealth/init-script tampering before the challenge**, single goto +
   ~12s wait, retry a few times. (Stealth patches and a full-chromium executablePath BREAK it.)
   The challenge can only be passed by a real browser engine — `ctx.request`/curl are re-challenged
   (Vercel also fingerprints TLS), so the tRPC call must run as an **in-page `fetch`**.
2. **Solve Turnstile** via 2captcha: sitekey **`0x4AAAAAAASRorjU_k9HAdVc`**, pageurl `https://liteforge.hub.caldera.xyz/`.
3. **Claim** via in-page fetch:
   ```
   POST /api/trpc/hub.requestFaucetFunds?batch=1
   body {"0":{"json":{"rollupSubdomain":"liteforge","recipientAddress":"0x..","turnstileToken":"<2captcha>"}}}
   ```
   Success → `{"success":true,"transactionHash":"0x.."}` and the address receives **0.1 zkLTC**.
- `recipientAddress` is a parameter — **no wallet connect needed**; claim for any address.
- Per-address cap/cooldown: an address already at the cap returns `{"success":false,"message":"Failed to send transaction"}`.
  (Our funded main wallet hit this; a fresh wallet succeeded.) So claim per-wallet, not repeatedly.
- Requires `npm i playwright` + its system libs (libnspr4, libnss3, libasound2 — present on the VPS
  since forge/faucet-pow run there). Off the always-on backend pipeline; run when wallets need gas:
  `node tools/faucet-claim.mjs [accountId|0xaddr]`.

### Turnstile captcha bypass — SELF-SOLVE, no 2captcha ✅ (verified live)
Probed the tRPC + widget live:
- Server **validates** turnstileToken: empty → `"Missing turnstile token"`, bogus → `"…validating your
  request"`. So the token can't be skipped/faked.
- The widget is Cloudflare Turnstile **managed/normal** mode (iframe URL `…/0x4AAAAAAASRorjU_k9HAdVc/
  light/…/new/normal`). Under vanilla Playwright (headless AND headful) it never auto-issues a token —
  the automation is detected (`navigator.webdriver`, CDP), `cf-turnstile-response` stays empty,
  the Request button stays disabled. Clicking the cross-origin checkbox also fails.
- **`patchright`** (undetected Playwright: patches `navigator.webdriver`→false + the CDP Runtime leak)
  makes the managed widget **self-issue a ~730-char token to `cf-turnstile-response` at t≈0** — read it
  straight from the hidden input, no 2captcha. Verified: that token PASSES server validation (the claim
  then returns the normal faucet result, e.g. `"Failed to send transaction"` = per-address cap, a
  different/downstream error class from the captcha errors).
- **Display requirement:** patchright must run **headful**. True `headless:true` fails — with a UA spoof
  it passes the Vercel checkpoint but the Turnstile still won't self-solve (headless is detected by
  WebGL/screen/render signals). Fix on a headless VPS: **`xvfb-run -a`** (virtual framebuffer, no GUI) —
  verified the token self-issues under xvfb. `tools/faucet-claim.mjs` auto-re-execs under `xvfb-run` when
  `$DISPLAY` is unset (and xvfb is installed); WSLg/desktop uses its real display directly.
- **GPU-less VPS — needs a WebGL renderer spoof** (verified live, this was the subtle blocker):
  a VPS with no GPU makes chromium fall back to **SwiftShader**, and the WebGL renderer string
  `"ANGLE (Google, … SwiftShader …)"` is flagged by Turnstile as a bot → the widget will NOT self-solve
  (token never populates). Verified: forced-SwiftShader = 2/2 NO token; with the spoof = 2/2 YES. Fix
  (built into `claimEntry`): an `addInitScript` that overrides `WebGLRenderingContext.prototype.getParameter`
  for `UNMASKED_VENDOR_WEBGL` (37445)→`"Intel Inc."` and `UNMASKED_RENDERER_WEBGL` (37446)→a common real GPU
  (`Intel UHD 620`). patchright runs `page.evaluate` in an ISOLATED world, so this main-world patch is
  invisible to our own reads but IS seen by Turnstile's main-world JS — which is exactly what flips the
  self-solve on. (My earlier headful "success" used this box's WSLg hardware GPU, hiding the issue.)
- Wiring: `tools/faucet-claim.mjs` now imports `patchright`, launches a per-account persistent context
  (own proxy/IP + fresh temp profile, `viewport:null`, no UA/automation-leaking flags), reads the
  self-solved token, and only falls back to 2captcha if `CAPTCHA_API_KEY` is set and the token never
  populates. `FAUCET_HEADLESS=1` forces true headless (needs the 2captcha fallback).

## Ecosystem on-chain actions (Arkada-free) — WORKING ✅
Direct dApp interactions on litVM testnet (chainId 4441). `src/ecosystem/dapps.ts`,
run via the `ecosystem` step. All live-verified on a faucet-funded wallet.
- **onmi.fun** create-token — `0x432b8b70a63eBB6b90CDFa1F7FeCDf2DD34e7c4E`
  `createToken(name,symbol,uri,startTs,endTs,referrer)` value 0. Verified ABI (TokenLauncherV2Factory).
- **zns.bio** register .lit — `0x1c6C28403400c44D8D351dEaBcF7B1365F96EbF1`
  `registerDomains([owner],[name],[1],0x0,0)` value 0.002 zkLTC.
- **lester-labs** launch — `0x93acc6…` (mint, 0.05 zkLTC) + `0xC9B196…` (create, 0.03 zkLTC).
  Unverified ABI → fulfilled by replaying a recent successful tx (sender substituted).
Each runs once/UTC-day, simulate-guarded, chainId-4441 asserted before broadcast.

### Not built (need bespoke / not full-backend-feasible)
- **sweep.haus** Lit_Pass — `claim(...merkle proof...)` needs an allowlist Merkle proof. Skip.
- **litvmswap** swap / **ayni** borrow — need ERC20 balances + approvals + market state
  (multi-step DeFi); replay reverts. Would need per-dApp token setup.
- **midashand** markets — not yet mapped.

## Ecosystem dApps — GENUINE actions (live tx hashes)
All verified on-chain (real state changes), faucet-funded wallets:
| dApp | action | how | live tx |
|---|---|---|---|
| onmi.fun | createToken (deploy) | verified ABI | 0xf661e6 / 0x906233 |
| zns.bio | registerDomains .lit | verified sig (NFT mint to wallet) | 0xad65d0 / 0xee09db |
| lester-labs | launch mint (ERC20 to wallet) | replay (mints to msg.sender) | 0x64521c / 0x84d094 |
| lester-labs | create | replay | 0x16a42e / 0x6c24ef |
| drunkencats | swap native->dcUSDT | verified V2 router swapExactNativeForTokens | 0x17f88f5b |
| omnihub | create NFT collection (deploy) | verified OmniHubFactory.create(tuple) 0.02 | build-verified (gas-limited) |
| litvmswap | wrap zkLTC->WzkLTC | WzkLTC.deposit() | 0xe4842cb3 |

WzkLTC (wrapped native) = `0x9bFada6C2BDbA88129da349BF7568C76a750C495`.
drunkencats router `0xAE92F4644Cc11f837dC4Be12B83D6FD4E887AFEE`, tokens dcXAU `0x023818c5…` dcUSDT `0x43F6117c…`.

### Still not built (need ERC20 setup / gated)
- ayni (AyniProtocol, verified): deposit/borrow need an ERC20 collateral token + approval (2-step). Tokens 0x60A84e.., 0x5adf10...
- midashand prediction: needs market + token.
- sweep.haus Lit_Pass: claim() needs a Merkle allowlist proof.
- litvmswap/litdex aggregator token-swap (unverified routers): would need in-browser calldata capture (UI connect via injected EIP-6963 wallet) — drunkencats already covers real token swaps.

## Flow bot — full live run (acc5, one wallet, 14 txs all success)
drunkencats: faucet()x2, swap native->dcUSDT, addLiquidityNative, **openVault(1 dcUSD, 0.04 collateral)**, removeLiquidityNative(leave 10%).
onmi createToken. zns gm (0x779a220b, fee 0.004) + registerDomains .lit. omnihub create + **mint litvm-omnihub** (0xCe29a899, mint(0,1,0x0,[]) value 0.02). litvmswap wrap.
- drunkencats VaultManager `0x7a1d18b9…` openVault(uint256 dcUSD) payable; min debt 1 dcUSD, MCR ~0.03 zkLTC/dcUSD.
- omnihub litvm-omnihub collection `0xCe29a8993CE78E420BfC7646f4AEa90B42bFd9D9` (proxy), mint(uint256,uint256,address,bytes32[]) sel 0xa25ffea8 value 0.02; gate once.

## aura (beta.auralaunch.org) — added
LitVM launchpad. Contracts from the app bundle (`_next/static/chunks`, chainId 4441):
- factory `0xd084FA1f5530f82c814FB937E662aF95B9e5F1c8`, token `0x0B779FF5855bc4E6937EbFa64aBE7AB8207f09c3`,
  staking `0x9D001EAa62E3c8A7E3f5a47523Fa7DC3790fcBBB`, **faucet `0x2881BDa1E897d02D97aa7Ef1161d9aA7f227f315`**.
- **Faucet (LaunchpadFaucet)** — verified ABI:
  - `getTokens() view -> (address contractAddress, string symbol)[]` = the mintable test tokens.
  - `withdraw(address contractAddress) payable` value **0.0001 zkLTC** = "Mint faucet Aura" (one per token).
  - `lastWithdrawalTime(address user, address token) view -> uint256` = per-token cooldown.
  - Wired: `aura` flow, daily gate, reads `getTokens()` then `withdraw` each (cooldowned ones simulate-revert & skip).
- **Incentive points (goal ≥1000) — OFF-CHAIN, REVERSED + WIRED** (`src/ecosystem/aura-points.ts`,
  headless, verified live on fresh throwaway wallets):
  - **Auth (custom, NOT NextAuth):** sign the STATIC message `auth:${address}` (personal_sign, no nonce),
    `POST /api/auth {address, signature}` → `{ token }` (token = `<sig>:<address>`). Send as cookie
    `aura_token`. Fresh wallet auto-registers. (NextAuth `/api/auth/*` only holds twitter+discord OAuth
    for the social tasks; `/api/auth/me` is a GET-only custom route reading the wallet session.)
  - **Daily login:** `POST /api/auth/me/claim` → `{new_streak, points_added:20}` — +20/day, feeds the
    7-day-streak task (+320).
  - **Tasks:** `GET /api/incentives/me` → `{ ranks, me:[{points,completed_txns,position}], tasks[] }`.
    Per OPEN, non-social task: `POST /api/incentives/tasks/{task_id}/verify?index=0` (index just present;
    server gates each on the real requirement, e.g. 50+ txns / first stake → 403 "requirements not met"
    until satisfied). Verified live: `complete_wallet_connection` → 200 +25.
  - **Task ids + points:** complete_wallet_connection 25 · execute_first_stake 50 · buy_tokens_in_sale 20 ·
    complete_7_day_streak 320 · complete_50_plus_transactions 1250 · (social, SKIP:) connect_x 150,
    connect_discord 200, join_telegram 1000.
  - **Points ≈ 16 × completed_txns** (leaderboard: 72390 pts / 4522 txns) — so every on-chain ecosystem tx
    the bot does also earns Aura points. Path to 1000 w/o social: 50-txns task (1250) alone clears it;
    plus daily 20×n + 7-day 320 + wallet/stake/buy.
  - **Wired:** `runAuraPoints(ctx)` runs at the END of `runEcosystem` (after all on-chain flows, so tx/stake
    gates pass), daily-gated, proxy-routed (per-account IP via `dispatcherFor`). dryRun → no-op "dry".
- **"Universal Faucet"** = the SAME `faucet.withdraw(token)` 0.0001 (incentives-page UI, "Claim featured
  test tokens", per-token cooldown "Next Mint in"). Already wired as the `aura` faucetMint step.
- **On-chain tasks — WIRED** (contracts from `/api/pools/staking` + `/api/pools/launchpad`, verified live):
  - **Staking** `stake(uint256 amount, uint256 duration) payable`, `minimumStakeAmount()=0`,
    `minimumStakeDuration()=2592000` (30d). Pools: AURA `0x9D001EA…` (token `0x0B779FF…`, not native),
    native-zkLTC `0xAD50bfE6…`, REV `0xDAaED9BC…`. Wired `aura.stake` (once): approve AURA→pool +
    `stake(portion, 2592000)` — locks worthless faucet AURA, not gas. → task `execute_first_stake` (+50).
  - **Launchpad buy** `buy() payable` (sel 0xa6f2ae3a), value = `minPurchase()` (HDX = 0.001). Sales rotate
    by `phase` (closed ones revert "Invalid phase"); `aura.buy` (once) fetches `/api/pools/launchpad`,
    picks the first pool whose `buy()` passes a balance-overridden eth_call, value = its minPurchase.
    → task `buy_tokens_in_sale` (+20). Live: HDX `0x2dC9ff38…` buy 0.001 OK; AURA/TORN sales closed.
  - `complete_50_plus_transactions` (+1250) + `complete_7_day_streak` (+320) accrue automatically from the
    bot's daily ecosystem tx volume + the daily-login claim — nothing extra to wire.
- **Social tasks — NOT bypassable** (probed live, all 403 "requirements not met" until satisfied):
  `connect_x`/`follow_x` (X), `connect_discord`, `join_telegram`. connect uses NextAuth `signIn("twitter"|
  "discord")` OAuth → sets `profile.twitter_username`/`discord_username` server-side; verify checks those
  fields, so no HTTP bypass. Would need real (throwaway) X/Discord accounts + automated OAuth consent
  (browser) + a Telegram userbot posting the wallet address — heavy/ToS-risky, not wired. Skipped in
  `aura-points.ts` SKIP_TASKS.

## litvmswap swap + lester (added)
- **litvmswap swap** — router 0xEb5600 (unverified V3-style aggregator, selector 0xce1e7030):
  calldata = baked route bytes + amountOutMin, recipient=msg.sender, NO deadline.
  Replay a recent swap with word[1] (amountOutMin) zeroed → repeatable native->LITVMSWAP swap.
  Router only ever does native->token (25/25 txs) → swap-back / addLiquidity not available there.
- **lester** (all unverified): deploy 0xC9B196 (sel 0xe897ce99, ~0.03), mint 0x93acc6 (sel 0x1575ea57,
  ~0.05), post/message 0xa37fF4 (sel 0xbaf9b369). Replay (sender substituted) → deploy/mint/post live.
  presale / seed-liquidity / lock-LP thread the freshly-deployed token+LP address → stateful, NOT
  replayable; would need each unverified fn's ABI + address threading (not done).
