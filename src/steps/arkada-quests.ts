import type { Step, Ctx, StepResult } from "./types.js";
import { saveStepState } from "../state.js";
import { runQuests } from "../arkada/runner.js";

export const arkadaQuestsStep: Step = {
  name: "arkada-quests",
  enabled: (cfg) => cfg.steps.arkada && cfg.arkada.enabled,
  async shouldRun() { return true; },          // per-quest gating happens inside runQuests
  async run(ctx: Ctx): Promise<StepResult> {
    const summary = await runQuests(ctx);
    saveStepState(ctx.acc.id, "arkada-quests", { lastRunUtcDay: new Date().toISOString().slice(0, 10), data: summary });
    ctx.log(`arkada-quests: ${Object.entries(summary).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    return "ran";
  },
};
