import type { Step, Ctx, StepResult } from "./types.js";

export async function runStep(step: Step, ctx: Ctx): Promise<StepResult> {
  if (!step.enabled(ctx.cfg)) { ctx.log(`${step.name}: disabled`); return "skipped"; }
  try {
    if (!(await step.shouldRun(ctx))) { ctx.log(`${step.name}: already done, skip`); return "skipped"; }
    return await step.run(ctx);
  } catch (e) {
    ctx.log(`${step.name}: ERROR ${(e as Error).message}`);
    return "skipped";
  }
}
