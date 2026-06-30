import { encodeFunctionData, parseAbi } from "viem";

// Direct on-chain actions on litVM testnet ecosystem dApps (no Arkada).
// Each builder returns the raw tx for the wallet to send. Args/ABIs were decoded
// from real successful txs on the live explorer (see docs/litvm-live-notes.md).

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const rand = (n: number) => Math.random().toString(36).slice(2, 2 + n);

export type Built = { to: `0x${string}`; data: `0x${string}`; value: bigint };

export type Dapp = {
  name: string;
  to: `0x${string}`;
  build: (addr: `0x${string}`) => Built;
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
};
