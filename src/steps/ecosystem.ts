import type { Step, Ctx, StepResult } from "./types.js";
import { saveStepState } from "../state.js";
import { runEcosystem } from "../ecosystem/runner.js";

export const ecosystemStep: Step = {
  name: "ecosystem",
  enabled: (cfg) => cfg.steps.ecosystem,
  async shouldRun() { return true; },        // per-dApp daily gating happens inside runEcosystem
  async run(ctx: Ctx): Promise<StepResult> {
    const summary = await runEcosystem(ctx);
    saveStepState(ctx.acc.id, "ecosystem", { lastRunUtcDay: new Date().toISOString().slice(0, 10), data: summary });
    ctx.log(`ecosystem: ${Object.entries(summary).map(([k, v]) => `${k}=${String(v).slice(0, 14)}`).join(" ")}`);
    return "ran";
  },
};
