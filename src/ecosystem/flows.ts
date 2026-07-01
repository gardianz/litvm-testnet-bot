import { parseAbi, encodeFunctionData, type PublicClient } from "viem";
import { balanceOf, ensureAllowance } from "./erc20.js";
import { replayCalldata } from "../arkada/onchain.js";

export type Tx = { to: `0x${string}`; data: `0x${string}`; value: bigint; label?: string };
export type FlowCtx = { address: `0x${string}`; pub: PublicClient };
// gate: once = ever; daily = per UTC day; always = every run
export type FlowStep = { id: string; gate: "once" | "daily" | "always"; build: (ctx: FlowCtx) => Promise<Tx[]> };
export type Flow = { dapp: string; steps: FlowStep[] };

const rand = (n: number) => Math.random().toString(36).slice(2, 2 + n);
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const dl = () => BigInt(Math.floor(Date.now() / 1000) + 600);
const enc = (sig: string, fn: string, args: any[]) => encodeFunctionData({ abi: parseAbi([sig]) as any, functionName: fn, args });

// ---- drunkencats (all verified) ----
const WZKLTC = "0x9bFada6C2BDbA88129da349BF7568C76a750C495" as const;
const DC_ROUTER = "0xAE92F4644Cc11f837dC4Be12B83D6FD4E887AFEE" as const;
const DC_FACTORY = "0x7D0FFa854edaE7659A1989Be42Df4CCe218F4c8C" as const;
const DCUSDT = "0x43F6117cF64c0c19AC6072f68d010ab10acD224C" as const;
const DCXAU = "0x023818c55233bdF400506703D27Dc91C7a04001f" as const;
const DCUSDC = "0x61cbb9b7385229d50352e277ee032d7518f5f71f" as const;
const DCETH = "0xcd44c7c7bc71f77e752bf4c27174c349becd5fc4" as const;
const DCBTC = "0x5b2db9d80be46019baeaad41ad94c3af5e155245" as const;
const DC_TOKENS = [DCUSDC, DCUSDT, DCETH, DCBTC, DCXAU] as const; // all faucet() TestERC20
const SMALL = 500000000000000n; // 0.0005 zkLTC — small, won't drain

const FACTORY_ABI = parseAbi(["function getPair(address,address) view returns (address)"]);

const drunkencats: Flow = {
  dapp: "drunkencats",
  steps: [
    { id: "faucet", gate: "daily", build: async () =>
      DC_TOKENS.map((t) => ({ to: t, data: enc("function faucet()", "faucet", []), value: 0n, label: `faucet ${t.slice(0, 8)}` })) },
    { id: "swap", gate: "daily", build: async ({ address }) => [
      { to: DC_ROUTER, value: SMALL, label: "swap native->dcUSDT",
        data: enc("function swapExactNativeForTokens(uint256,address[],address,uint256)", "swapExactNativeForTokens", [0n, [WZKLTC, DCUSDT], address, dl()]) },
    ] },
    { id: "addLiquidity", gate: "daily", build: async ({ address, pub }) => {
      const bal = await balanceOf(pub, DCUSDT, address);
      if (bal === 0n) return [];
      const amt = bal / 10n > 0n ? bal / 10n : bal;            // small portion
      const txs: Tx[] = [];
      const ap = await ensureAllowance(pub, DCUSDT, address, DC_ROUTER, amt);
      if (ap) txs.push({ ...ap, label: "approve dcUSDT" });
      txs.push({ to: DC_ROUTER, value: SMALL, label: "addLiquidityNative",
        data: enc("function addLiquidityNative(address,uint256,uint256,uint256,address,uint256)", "addLiquidityNative", [DCUSDT, amt, 0n, 0n, address, dl()]) });
      return txs;
    } },
    { id: "createVault", gate: "once", build: async () => [
      // VaultManager.openVault(dcUSDAmount) payable — collateral = native value.
      // Protocol minimums: debt >= 1 dcUSD, ICR >= MCR (~0.03 zkLTC/1 dcUSD). Open one vault per address.
      { to: "0x7a1d18b9172E60d7587dd3180697277e75558E41", value: 40000000000000000n, label: "openVault 1 dcUSD",
        data: enc("function openVault(uint256)", "openVault", [1000000000000000000n]) },
    ] },
    { id: "removeLiquidity", gate: "daily", build: async ({ address, pub }) => {
      const pair = await pub.readContract({ address: DC_FACTORY, abi: FACTORY_ABI, functionName: "getPair", args: [DCUSDT, WZKLTC] }) as `0x${string}`;
      if (!pair || pair === ZERO) return [];
      const lp = await balanceOf(pub, pair, address);
      if (lp === 0n) return [];
      const remove = (lp * 9n) / 10n;                          // leave ~10%
      if (remove === 0n) return [];
      const txs: Tx[] = [];
      const ap = await ensureAllowance(pub, pair, address, DC_ROUTER, remove);
      if (ap) txs.push({ ...ap, label: "approve LP" });
      txs.push({ to: DC_ROUTER, value: 0n, label: "removeLiquidityNative",
        data: enc("function removeLiquidityNative(address,uint256,uint256,uint256,address,uint256)", "removeLiquidityNative", [DCUSDT, remove, 0n, 0n, address, dl()]) });
      return txs;
    } },
  ],
};

// ---- onmi.fun: create coin only ----
const onmi: Flow = {
  dapp: "onmi",
  steps: [{ id: "createToken", gate: "daily", build: async () => {
    const now = BigInt(Math.floor(Date.now() / 1000)); const tag = rand(4).toUpperCase();
    return [{ to: "0x432b8b70a63eBB6b90CDFa1F7FeCDf2DD34e7c4E", value: 0n, label: "onmi createToken",
      data: enc("function createToken(string,string,string,uint256,uint256,address)", "createToken",
        [`LitVM ${tag}`, `LVT${tag}`, `https://litvm.local/${rand(8)}.json`, now, now + 3600n, ZERO]) }];
  } }],
};

// ---- zns: daily gm + register .lit once ----
const zns: Flow = {
  dapp: "zns",
  steps: [
    { id: "gm", gate: "daily", build: async () => [
      // gm-deploy daily check-in (unverified). selector 0x779a220b + fixed gm-target address,
      // fee 0.004 zkLTC (decoded from a live gm tx).
      { to: "0x780Ae565a4104b3099dAb72d9610656b94F1389F", value: 4000000000000000n, label: "zns gm",
        data: "0x779a220b0000000000000000000000005de0650216ce5251db7a6d2d701d10fe42bd2f45" },
    ] },
    { id: "register", gate: "once", build: async ({ address }) => [
      { to: "0x1c6C28403400c44D8D351dEaBcF7B1365F96EbF1", value: 2000000000000000n, label: "zns register .lit",
        data: enc("function registerDomains(address[],string[],uint256[],address,uint256)", "registerDomains", [[address], [`litvm${rand(8)}`], [1n], ZERO, 0n]) },
    ] },
  ],
};

// ---- omnihub: mint the litvm-omnihub collection once + create a collection daily ----
const OMNIHUB_FACTORY = "0x7798f2Eb73C1Dd8Fa8086d780D5CF114A10F528E" as const;
const omnihub: Flow = {
  dapp: "omnihub",
  steps: [
    { id: "create", gate: "daily", build: async () => {
      const now = BigInt(Math.floor(Date.now() / 1000)); const tag = rand(5).toUpperCase();
      return [{ to: OMNIHUB_FACTORY, value: 20000000000000000n, label: "omnihub create collection",
        data: enc("function create((string,string,string,uint256,uint256,bool,(string,uint256,uint256,uint256,uint256,bytes32),(string,string,string,bool)))", "create",
          [[`LitVM ${tag}`, `OH${tag}`, "LitVM testnet collection", 500n, 0n, true,
            ["Public Mint", now, now + 15552000n, 0n, 0n, "0x0000000000000000000000000000000000000000000000000000000000000000"],
            [`https://litvm.local/oh/${rand(8)}.json`, "https://litvm.local/oh/", "https://litvm.local/oh/img.png", false]]]) }];
    } },
    // litvm-omnihub collection mint — once per address. mint(phaseId, qty, referrer, proof[]) value 0.02.
    { id: "mintLitvmOmnihub", gate: "once", build: async () => [
      { to: "0xCe29a8993CE78E420BfC7646f4AEa90B42bFd9D9", value: 20000000000000000n, label: "mint litvm-omnihub",
        data: enc("function mint(uint256,uint256,address,bytes32[])", "mint", [0n, 1n, ZERO, []]) },
    ] },
  ],
};

// ---- litvmswap: swap native->token (aggregator) + wrap->unwrap ----
const EXPLORER = "https://liteforge.explorer.caldera.xyz";
const LVS_ROUTER = "0xEb5600899BD87F0dF9200dEaD5B8098B63708C75" as const;
// litvmswap router is an unverified V3-style aggregator: calldata carries a baked
// route (bytes) + amountOutMin, recipient = msg.sender, NO deadline. Replay a recent
// successful swap but zero amountOutMin (word[1]) so it can't revert on slippage.
async function litvmswapSwapTx(selector: string): Promise<Tx | null> {
  let it: any;
  try {
    const r = await fetch(`${EXPLORER}/api/v2/addresses/${LVS_ROUTER}/transactions?filter=to`, { signal: AbortSignal.timeout(15000) });
    const j: any = await r.json();
    it = (j.items ?? []).find((x: any) => x?.result === "success" && typeof x?.raw_input === "string" && x.raw_input.slice(0, 10) === selector);
  } catch { return null; }
  if (!it) return null;
  const raw: string = it.raw_input;
  const start = 10 + 64; // zero word[1] = amountOutMin
  const data = (raw.slice(0, start) + "0".repeat(64) + raw.slice(start + 64)) as `0x${string}`;
  return { to: LVS_ROUTER, data, value: BigInt(it.value ?? "0"), label: "litvmswap swap native->token" };
}

const litvmswap: Flow = {
  dapp: "litvmswap",
  steps: [
    { id: "swap", gate: "daily", build: async () => { const t = await litvmswapSwapTx("0xce1e7030"); return t ? [t] : []; } },
    { id: "wrap", gate: "daily", build: async () => [
      { to: WZKLTC, value: SMALL, label: "wrap zkLTC->WzkLTC", data: enc("function deposit()", "deposit", []) },
    ] },
    { id: "unwrap", gate: "daily", build: async ({ address, pub }) => {
      const bal = await balanceOf(pub, WZKLTC, address);
      if (bal === 0n) return [];
      return [{ to: WZKLTC, value: 0n, label: "unwrap all WzkLTC->zkLTC", data: enc("function withdraw(uint256)", "withdraw", [bal]) }];
    } },
  ],
};

// ---- lester-labs launchpad (all contracts unverified) ----
// Feasible steps replay a recent successful call (sender substituted → credits us):
//   deploy (token launch), mint, post-update (ledger message).
// The stateful presale/seed-liquidity/lock-LP steps thread the freshly-deployed
// token/LP address, so they can't be replayed — left out (see live-notes).
const LESTER_DEPLOY = "0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f" as const;
const LESTER_MINT = "0x93acc61fcdc2e3407A0c03450Adfd8aE78964948" as const;
const LESTER_MESSAGE = "0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079" as const;
const replayStep = (id: string, to: `0x${string}`, label: string): FlowStep => ({
  id, gate: "daily", build: async ({ address }) => {
    const r = await replayCalldata(EXPLORER, to, address);
    return r ? [{ to, data: r.data, value: r.value, label }] : [];
  },
});
const lester: Flow = {
  dapp: "lester",
  steps: [
    replayStep("deploy", LESTER_DEPLOY, "lester deploy token"),
    replayStep("mint", LESTER_MINT, "lester mint"),
    replayStep("post", LESTER_MESSAGE, "lester post update"),
  ],
};

export const FLOWS: Flow[] = [drunkencats, onmi, zns, omnihub, litvmswap, lester];
export const FLOW_MAP: Record<string, Flow> = Object.fromEntries(FLOWS.map((f) => [f.dapp, f]));
