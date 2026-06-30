# LitVM LiteForge — Verified Live Notes

> Capture these from the live sites (DevTools > Network on your own machine) and
> paste into config.yaml. Record a tx hash / sample response proving each works.

## Chain
- chainId 4441, RPC https://liteforge.rpc.caldera.xyz/infra-partner-http, native zkLTC
- explorer https://liteforge.explorer.caldera.xyz

## Register (testnet.litvm.com)  -> config.registerApi
- nonce route: ____   verify route: ____   token field: ____

## Faucet (liteforge.hub.caldera.xyz)  -> config.faucetEndpoint / faucetSitekey
- POST endpoint: ____   turnstile sitekey: ____   body shape: ____

## Arkada (app.arkada.gg)  -> config.arkada.*
- apiBase: ____
- nonceRoute: ____   verifyLoginRoute: ____   token field: ____
- questsRoute (use {campaign}): ____   verifyRoute (use {id}): ____   claimRoute: ____

## Quest -> on-chain action map  -> config.questActions[<slug>]
For each map node, run `npm run discover -- <contract>` to confirm the fn, then add:
  <slug>: { address, signature: "function ...", args: [...], valueWei: "..." }
- ____
