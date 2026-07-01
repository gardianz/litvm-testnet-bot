import { describe, it, expect, vi } from "vitest";
import { FLOW_MAP } from "../src/ecosystem/flows.js";
import { runEcosystem } from "../src/ecosystem/runner.js";

const ADDR = "0x000000000000000000000000000000000000dEaD";

describe("flows", () => {
  it("drunkencats has the full flow steps", () => {
    const ids = FLOW_MAP["drunkencats"].steps.map((s) => s.id);
    expect(ids).toEqual(["faucet", "swap", "addLiquidity", "createVault", "removeLiquidity"]);
  });
  it("zns gm is daily, register is once", () => {
    const zns = FLOW_MAP["zns"];
    expect(zns.steps.find((s) => s.id === "gm")!.gate).toBe("daily");
    expect(zns.steps.find((s) => s.id === "register")!.gate).toBe("once");
  });
  it("drunkencats faucet builds 5 no-value token faucet txs", async () => {
    const txs = await FLOW_MAP["drunkencats"].steps[0].build({ address: ADDR, pub: {} as any });
    expect(txs.length).toBe(5);
    expect(txs.every((t) => t.value === 0n)).toBe(true);
  });
});

function ctx(dapps: string[], over: any = {}) {
  return {
    cfg: { ecosystem: { dapps }, chainId: 4441 },
    acc: { id: "acc1" }, state: {}, dryRun: true, log: () => {},
    clients: { address: ADDR, public: { call: vi.fn(async () => ({})), getChainId: async () => 4441 }, wallet: { account: { address: ADDR } } },
    ...over,
  } as any;
}

describe("runEcosystem", () => {
  it("dry-run simulates steps without sending", async () => {
    const c = ctx(["onmi"]);
    const out = await runEcosystem(c);
    expect(out["onmi.createToken"]).toMatch(/^dry/);
    expect(c.clients.public.call).toHaveBeenCalled();
  });
  it("unknown flow reported", async () => {
    expect((await runEcosystem(ctx(["nope"])))["nope"]).toBe("unknown-flow");
  });
  it("respects once-gate done state", async () => {
    const c = ctx(["zns"], { state: { "flow:zns:register": { done: true } } });
    const out = await runEcosystem(c);
    expect(out["zns.register"]).toBe("done(once)");
  });
});
