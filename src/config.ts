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
    campaign: z.string().default("litvm"),
    apiBase: z.string().optional(),
    nonceRoute: z.string().optional(),
    verifyLoginRoute: z.string().optional(),
    questsRoute: z.string().optional(),
    verifyRoute: z.string().optional(),
    claimRoute: z.string().optional(),
  }).default({ enabled: true, campaign: "litvm" }),
  questActions: z.record(z.string(), QuestActionSchema).default({}),
  steps: z.object({
    register: z.boolean().default(true),
    faucet: z.boolean().default(true),
    arkada: z.boolean().default(true),
  }).default({ register: true, faucet: true, arkada: true }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(path = "config.yaml"): Config {
  return ConfigSchema.parse(load(readFileSync(path, "utf8")));
}
