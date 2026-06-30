import type { Step, Ctx, StepResult } from "./types.js";
import { ranToday, markRan } from "../state.js";
import { hasMinGas } from "../balances.js";
import { claimFaucet } from "../faucet.js";

export const faucetStep: Step = {
  name: "faucet",
  enabled: (cfg) => cfg.steps.faucet,
  async shouldRun(ctx: Ctx) {
    const lowGas = !(await hasMinGas(ctx.clients.public, ctx.clients.address, ctx.cfg.faucet.minGas));
    const daily = ctx.cfg.faucet.daily && !ranToday(ctx.state, "faucet");
    return lowGas || daily;
  },
  async run(ctx: Ctx): Promise<StepResult> {
    if (ctx.dryRun) { ctx.log("faucet: dry-run, would claim"); return "ran"; }
    const r = await claimFaucet({
      faucetUrl: ctx.cfg.faucetUrl, address: ctx.clients.address,
      endpoint: ctx.cfg.faucetEndpoint, apiKey: process.env.CAPTCHA_API_KEY, sitekey: ctx.cfg.faucetSitekey,
    });
    if (!r.ok) { ctx.log(`faucet: skip (${r.reason}) — fund manually if no-endpoint`); return "skipped"; }
    markRan(ctx.acc.id, "faucet", { txs: r.tx ? [r.tx] : [] });
    ctx.log(`faucet: claimed ${r.tx ?? ""}`);
    return "ran";
  },
};
