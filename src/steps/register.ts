import type { Step, Ctx, StepResult } from "./types.js";
import { saveStepState } from "../state.js";
import { buildSiweMessage, signSiwe } from "../siwe.js";

export const registerStep: Step = {
  name: "register",
  enabled: (cfg) => cfg.steps.register,
  async shouldRun(ctx: Ctx) { return ctx.state["register"]?.done !== true; },
  async run(ctx: Ctx): Promise<StepResult> {
    const api = ctx.cfg.registerApi;
    if (!api) { ctx.log("register: no registerApi configured — skip (discover live)"); return "skipped"; }
    if (ctx.dryRun) { ctx.log("register: dry-run, would sign+POST"); return "ran"; }
    const nonceRes: any = await (await fetch(`${api}/nonce?address=${ctx.clients.address}`)).json().catch(() => ({}));
    const nonce = nonceRes.nonce ?? nonceRes.data?.nonce;
    if (!nonce) { ctx.log("register: no nonce from API — skip"); return "skipped"; }
    const message = buildSiweMessage({
      domain: "testnet.litvm.com", address: ctx.clients.address, statement: "Sign in to LitVM testnet.",
      uri: "https://testnet.litvm.com", nonce, chainId: ctx.cfg.chainId,
    });
    const signature = await signSiwe(ctx.clients.wallet, message);
    const verify = await fetch(`${api}/verify`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: ctx.clients.address, message, signature }),
    });
    if (!verify.ok) { ctx.log(`register: verify http-${verify.status} — skip`); return "skipped"; }
    saveStepState(ctx.acc.id, "register", { done: true });
    ctx.log("register: ok");
    return "ran";
  },
};
