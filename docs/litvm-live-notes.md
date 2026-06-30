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
