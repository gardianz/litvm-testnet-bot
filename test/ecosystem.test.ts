import { describe, it, expect, vi } from "vitest";
import { DAPPS } from "../src/ecosystem/dapps.js";
import { runEcosystem } from "../src/ecosystem/runner.js";

const ADDR = "0x000000000000000000000000000000000000dEaD";

describe("dapps", () => {
  it("onmi-createToken builds a payable-0 call to the factory", () => {
    const b = DAPPS["onmi-createToken"].build!(ADDR);
    expect(b.to).toBe("0x432b8b70a63eBB6b90CDFa1F7FeCDf2DD34e7c4E");
    expect(b.value).toBe(0n);
    expect(b.data.startsWith("0x")).toBe(true);
    expect(b.data.length).toBeGreaterThan(100);
  });
  it("zns-register encodes the registration fee", () => {
    const b = DAPPS["zns-register"].build!(ADDR);
    expect(b.to).toBe("0x1c6C28403400c44D8D351dEaBcF7B1365F96EbF1");
    expect(b.value).toBe(2000000000000000n);
  });
  it("randomizes names each build", () => {
    expect(DAPPS["zns-register"].build!(ADDR).data).not.toBe(DAPPS["zns-register"].build!(ADDR).data);
  });
});

function ctx(over = {}) {
  return {
    cfg: { ecosystem: { dapps: ["onmi-createToken"] }, chainId: 4441 },
    acc: { id: "acc1" }, state: {}, dryRun: true, log: () => {},
    clients: { address: ADDR, public: { call: vi.fn(async () => ({})), getChainId: async () => 4441 }, wallet: { account: { address: ADDR } } },
    ...over,
  } as any;
}

describe("runEcosystem", () => {
  it("dry-run simulates without sending", async () => {
    const c = ctx();
    const out = await runEcosystem(c);
    expect(out["onmi-createToken"]).toBe("dry:ok");
    expect(c.clients.public.call).toHaveBeenCalledOnce();
  });
  it("reports revert from simulation", async () => {
    const c = ctx();
    c.clients.public.call = vi.fn(async () => { throw Object.assign(new Error("exec reverted"), { shortMessage: "execution reverted" }); });
    const out = await runEcosystem(c);
    expect(out["onmi-createToken"]).toMatch(/^revert:/);
  });
  it("skips unknown dapp", async () => {
    const c = ctx({ cfg: { ecosystem: { dapps: ["nope"] }, chainId: 4441 } });
    expect((await runEcosystem(c))["nope"]).toBe("unknown-dapp");
  });
});
