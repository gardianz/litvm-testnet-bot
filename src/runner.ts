import { formatEther } from "viem";
import type { Config } from "./config.js";
import type { Account } from "./accounts.js";
import type { Step, Ctx, StepResult } from "./steps/types.js";
import { runStep } from "./steps/executor.js";
import { makeClients, assertChain } from "./evm.js";
import { getGas } from "./balances.js";
import { loadState } from "./state.js";
import type { Dashboard } from "./dashboard.js";

type RunOpts = { dryRun: boolean; steps?: Step[]; only?: string; dash?: Dashboard };
import { registerStep } from "./steps/register.js";
import { faucetStep } from "./steps/faucet.js";
import { ecosystemStep } from "./steps/ecosystem.js";
import { arkadaQuestsStep } from "./steps/arkada-quests.js";

export const STEPS: Step[] = [registerStep, faucetStep, ecosystemStep, arkadaQuestsStep];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAccount(
  cfg: Config, acc: Account, opts: RunOpts,
): Promise<{ acc: string; steps: Record<string, StepResult> }> {
  const steps = (opts.steps ?? STEPS).filter((s) => !opts.only || s.name === opts.only);
  const clients = makeClients(cfg, acc);
  const dash = opts.dash;
  const log = dash?.enabled ? (m: string) => dash.log(`[${acc.id}] ${m}`) : (m: string) => console.log(`[${acc.id}] ${m}`);
  const baseCtx: Ctx = { cfg, acc, clients, state: loadState(acc.id), log, dryRun: opts.dryRun };
  if (dash) { dash.ensure(acc.id); getGas(clients.public, clients.address).then((g) => dash.setGas(acc.id, formatEther(g))).catch(() => {}); }
  let chainOk = true;
  try { await assertChain(clients.public); } catch (e) { chainOk = false; log(`chain assert failed: ${(e as Error).message}`); }
  const out: Record<string, StepResult> = {};
  for (const step of steps) {
    dash?.setStep(acc.id, step.name, "…");
    if (!chainOk && !opts.dryRun) { out[step.name] = "skipped"; dash?.setStep(acc.id, step.name, "skipped"); continue; }
    out[step.name] = await runStep(step, { ...baseCtx, state: loadState(acc.id) });
    dash?.setStep(acc.id, step.name, out[step.name]);
    if (cfg.stepDelayMs) await sleep(cfg.stepDelayMs);
  }
  return { acc: acc.id, steps: out };
}

function shuffle<T>(a: T[]): T[] { return a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v); }

export async function runAll(cfg: Config, accounts: Account[], opts: RunOpts) {
  const results = [];
  for (const acc of shuffle(accounts)) {
    if (cfg.accountJitterMs) await sleep(Math.floor(Math.random() * cfg.accountJitterMs));
    results.push(await runAccount(cfg, acc, opts));
    if (cfg.accountDelayMs) await sleep(cfg.accountDelayMs);
  }
  return results;
}
