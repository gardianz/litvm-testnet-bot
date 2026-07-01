import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { z } from "zod";

export const CHAIN_ID = 4441;

const QuestActionSchema = z.object({
  address: z.string(),
  signature: z.string(),                 // human-readable, e.g. "function mint()" / "function createToken(string,string,uint256)"
  args: z.array(z.union([z.string(), z.number(), z.boolean()])).default([]),
  valueWei: z.string().default("0"),
});
export type QuestAction = z.infer<typeof QuestActionSchema>;

const ConfigSchema = z.object({
  evmRpc: z.string().url(),
  explorerApi: z.string().url(),
  faucetUrl: z.string().url(),
  chainId: z.literal(CHAIN_ID).default(CHAIN_ID),
  registerApi: z.string().optional(),
  faucetEndpoint: z.string().optional(),
  faucetSitekey: z.string().optional(),
  dryRun: z.boolean().default(true),
  maxConcurrent: z.number().int().positive().default(1),
  stepDelayMs: z.number().int().nonnegative().default(3000),
  accountDelayMs: z.number().int().nonnegative().default(5000),
  accountJitterMs: z.number().int().nonnegative().default(15000),
  questDelayMs: z.number().int().nonnegative().default(4000),
  proxyFile: z.string().default("proxy.txt"),
  proxyRpc: z.boolean().default(true),
  encryptAccounts: z.boolean().default(false),   // encrypt accounts.json with ACCOUNTS_KEY (default: plain readable JSON)
  scheduleCron: z.string().default("0 9 * * *"),
  daemon: z.object({
    minHours: z.number().positive().default(22),
    maxHours: z.number().positive().default(26),
  }).default({ minHours: 22, maxHours: 26 }),
  faucet: z.object({
    daily: z.boolean().default(true),
    minGas: z.string().default("0.01"),
    provider: z.enum(["2captcha", "anticaptcha"]).default("2captcha"),
  }).default({ daily: true, minGas: "0.01", provider: "2captcha" }),
  arkada: z.object({
    enabled: z.boolean().default(true),
    apiBase: z.string().default("https://app-api.arkada.gg"),
    campaignPrefix: z.string().default("litvm"),   // litvm hub = every campaign slug starting with this
    signupChainId: z.number().int().default(CHAIN_ID),
    skipSocial: z.boolean().default(true),          // skip x.com/twitter/discord/t.me quests
    includeDaily: z.boolean().default(true),
    onchain: z.boolean().default(true),             // fulfil on-chain quests by replaying a tx to the target contract
    onchainMaxValueWei: z.string().default("50000000000000000"),  // 0.05 zkLTC cap per replayed tx (safety)
    onchainMaxTx: z.number().int().positive().default(8),         // cap txs sent per quest
  }).default({ enabled: true, apiBase: "https://app-api.arkada.gg", campaignPrefix: "litvm", signupChainId: CHAIN_ID, skipSocial: true, includeDaily: true, onchain: true, onchainMaxValueWei: "50000000000000000", onchainMaxTx: 8 }),
  questActions: z.record(z.string(), QuestActionSchema).default({}),
  ecosystem: z.object({
    dapps: z.array(z.string()).default(["drunkencats", "onmi", "zns", "omnihub", "litvmswap", "lester"]),
  }).default({ dapps: ["drunkencats", "onmi", "zns", "omnihub", "litvmswap", "lester"] }),
  steps: z.object({
    register: z.boolean().default(false),
    faucet: z.boolean().default(false),     // gas comes from `npm run faucet`/`faucet:loop` (browser). HTTP step disabled.
    arkada: z.boolean().default(false),     // Arkada reward needs Base mainnet gas — off by default
    ecosystem: z.boolean().default(true),   // direct on-chain litVM ecosystem actions
  }).default({ register: false, faucet: false, arkada: false, ecosystem: true }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(path = "config.yaml"): Config {
  return ConfigSchema.parse(load(readFileSync(path, "utf8")));
}
