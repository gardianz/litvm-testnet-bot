import { encodeFunctionData, parseAbi } from "viem";

// Direct on-chain actions on litVM testnet ecosystem dApps (no Arkada).
// Each builder returns the raw tx for the wallet to send. Args/ABIs were decoded
// from real successful txs on the live explorer (see docs/litvm-live-notes.md).

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const rand = (n: number) => Math.random().toString(36).slice(2, 2 + n);

export type Built = { to: `0x${string}`; data: `0x${string}`; value: bigint };

// A dApp action is either built from a known ABI (`build`) or fulfilled by
// replaying a recent successful tx to the contract with our address substituted
// in (`replay: true`) — used for unverified contracts whose calldata is not
// parameter-bound (token launchers, etc.).
export type Dapp = {
  name: string;
  to: `0x${string}`;
  build?: (addr: `0x${string}`) => Built;
  replay?: boolean;
};

export const DAPPS: Record<string, Dapp> = {
  // onmi.fun (app.onmi.fun/create-token) — TokenLauncherV2Factory.createToken
  // (name, symbol, metadataURI, startTs, endTs, referrer). value 0.
  "onmi-createToken": {
    name: "onmi.fun create-token",
    to: "0x432b8b70a63eBB6b90CDFa1F7FeCDf2DD34e7c4E",
    build(addr) {
      const now = Math.floor(Date.now() / 1000);
      const data = encodeFunctionData({
        abi: parseAbi(["function createToken(string,string,string,uint256,uint256,address)"]),
        functionName: "createToken",
        args: [
          `LitVM ${rand(4).toUpperCase()}`,
          `LVT${rand(3).toUpperCase()}`,
          `https://litvm.local/metadata/${rand(8)}.json`,
          BigInt(now),
          BigInt(now + 3600),
          ZERO,
        ],
      });
      return { to: this.to, data, value: 0n };
    },
  },

  // zns.bio (.lit domain) — registerDomains(owners[], names[], durations[], referrer, extra). fee ~0.002 zkLTC.
  "zns-register": {
    name: "zns.bio register .lit",
    to: "0x1c6C28403400c44D8D351dEaBcF7B1365F96EbF1",
    build(addr) {
      const data = encodeFunctionData({
        abi: parseAbi(["function registerDomains(address[],string[],uint256[],address,uint256)"]),
        functionName: "registerDomains",
        args: [[addr], [`litvm${rand(8)}`], [1n], ZERO, 0n],
      });
      return { to: this.to, data, value: 2000000000000000n }; // 0.002 zkLTC
    },
  },

  // lester-labs.com/launch — token launcher (unverified ABI). Calldata is not
  // parameter-bound, so replay a recent successful launch with our address.
  "lester-mint": { name: "lester-labs launch (mint)", to: "0x93acc61fcdc2e3407A0c03450Adfd8aE78964948", replay: true },
  "lester-create": { name: "lester-labs create", to: "0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f", replay: true },

  // drunkencats DEX (DrunkenCatsRouter, verified V2-style) — REAL swap:
  // swapExactNativeForTokens(amountOutMin, [WzkLTC, token], to, deadline) payable.
  // Native in → no approval. WzkLTC<->dcUSDT pool confirmed live.
  "drunkencats-swap": {
    name: "drunkencats swap (native->dcUSDT)",
    to: "0xAE92F4644Cc11f837dC4Be12B83D6FD4E887AFEE",
    build(addr) {
      const WZKLTC = "0x9bFada6C2BDbA88129da349BF7568C76a750C495" as const;
      const DCUSDT = "0x43F6117cF64c0c19AC6072f68d010ab10acD224C" as const;
      const data = encodeFunctionData({
        abi: parseAbi(["function swapExactNativeForTokens(uint256,address[],address,uint256)"]),
        functionName: "swapExactNativeForTokens",
        args: [0n, [WZKLTC, DCUSDT], addr, BigInt(Math.floor(Date.now() / 1000) + 600)],
      });
      return { to: this.to, data, value: 1000000000000000n }; // 0.001 zkLTC in
    },
  },

  // OmniHub (omnihub.xyz, OmniHubFactory verified) — REAL NFT collection deploy.
  // create((name,symbol,desc,supply,royalty,transferable,phase,metadata)) payable 0.02.
  "omnihub-create": {
    name: "omnihub create collection",
    to: "0x7798f2Eb73C1Dd8Fa8086d780D5CF114A10F528E",
    build(addr) {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const tag = rand(5).toUpperCase();
      const data = encodeFunctionData({
        abi: parseAbi([
          "function create((string,string,string,uint256,uint256,bool,(string,uint256,uint256,uint256,uint256,bytes32),(string,string,string,bool)))",
        ]),
        functionName: "create",
        args: [[
          `LitVM ${tag}`, `OH${tag}`, "LitVM testnet collection", 500n, 0n, true,
          ["Public Mint", now, now + 15552000n, 0n, 0n, "0x0000000000000000000000000000000000000000000000000000000000000000"],
          [`https://litvm.local/oh/${rand(8)}.json`, `https://litvm.local/oh/`, `https://litvm.local/oh/img.png`, false],
        ]],
      });
      return { to: this.to, data, value: 20000000000000000n }; // 0.02 zkLTC
    },
  },
};
