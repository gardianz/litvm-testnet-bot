import { describe, it, expect, vi } from "vitest";
import { runQuests } from "../src/arkada/runner.js";

function ctx(actions: any = {}, dryRun = true): any {
  return {
    cfg: { arkada: { enabled: true, campaign: "litvm" }, questActions: actions, chainId: 4441 },
    acc: { id: "acc1" }, state: {}, dryRun, log: () => {},
    clients: { wallet: { signMessage: async () => "0xsig", account: { address: "0xabc" } }, public: {}, address: "0xabc" },
  };
}

describe("runQuests", () => {
  it("returns no-login when login fails", async () => {
    const deps = { login: async () => null, list: async () => [], verify: async () => true, claim: async () => true, action: async () => ({ ran: true }) };
    expect(await runQuests(ctx(), deps)).toEqual({ arkada: "no-login" });
  });
  it("marks unmapped quests", async () => {
    const deps = {
      login: async () => ({ token: "t" }),
      list: async () => [{ id: "1", slug: "gm", name: "GM", completed: false, daily: false }],
      verify: async () => true, claim: async () => true, action: async () => ({ ran: true }),
    };
    expect(await runQuests(ctx(), deps)).toEqual({ gm: "unmapped" });
  });
  it("runs mapped quest -> action+verify+claim => done", async () => {
    const action = vi.fn(async () => ({ ran: true, tx: "0xtx" }));
    const verify = vi.fn(async () => true);
    const claim = vi.fn(async () => true);
    const deps = {
      login: async () => ({ token: "t" }),
      list: async () => [{ id: "1", slug: "gm", name: "GM", completed: false, daily: false }],
      verify, claim, action,
    };
    const res = await runQuests(ctx({ gm: { address: "0xc0", signature: "function gm()", args: [], valueWei: "0" } }, false), deps);
    expect(res).toEqual({ gm: "done" });
    expect(action).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledOnce();
  });
  it("skips already-completed non-daily quests", async () => {
    const action = vi.fn(async () => ({ ran: true }));
    const deps = {
      login: async () => ({ token: "t" }),
      list: async () => [{ id: "1", slug: "gm", name: "GM", completed: true, daily: false }],
      verify: async () => true, claim: async () => true, action,
    };
    const res = await runQuests(ctx({ gm: { address: "0xc0", signature: "function gm()", args: [], valueWei: "0" } }), deps);
    expect(res).toEqual({ gm: "already" });
    expect(action).not.toHaveBeenCalled();
  });
});
