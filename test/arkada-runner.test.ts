import { describe, it, expect, vi } from "vitest";
import { runQuests } from "../src/arkada/runner.js";

function ctx(actions: any = {}, dryRun = false): any {
  return {
    cfg: { arkada: { enabled: true, apiBase: "https://app-api.arkada.gg", campaignPrefix: "litvm", skipSocial: true, includeDaily: true }, questActions: actions, chainId: 4441 },
    acc: { id: "acc1" }, state: {}, dryRun, log: () => {},
    clients: { wallet: { signMessage: async () => "0xsig", account: { address: "0xabc" } }, public: {}, address: "0xabc" },
  };
}
const q = (o: any) => ({ id: o.id, slug: o.slug ?? "litvm-x", name: o.name ?? "Q", type: o.type ?? "link", link: o.link ?? "https://lester-labs.com", optional: false });

describe("runQuests", () => {
  it("no-login when login fails", async () => {
    const r = await runQuests(ctx(), { login: async () => null });
    expect(r).toEqual({ arkada: "no-login" });
  });

  it("link quest -> complete directly => done", async () => {
    const complete = vi.fn(async () => true);
    const r = await runQuests(ctx(), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-arkada"],
      getQuests: async () => [q({ id: "1", slug: "litvm-arkada", type: "link" })],
      check: async () => false, complete,
    });
    expect(r["litvm-arkada/Q"]).toBe("done");
    expect(complete).toHaveBeenCalledWith("1", "t");
  });

  it("social quest skipped", async () => {
    const r = await runQuests(ctx(), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-lester"],
      getQuests: async () => [q({ id: "2", slug: "litvm-lester", type: "social", link: "https://x.com/foo" })],
      complete: async () => true,
    });
    expect(r["litvm-lester/Q"]).toBe("social-skip");
  });

  it("on-chain quest: action -> check passes -> complete => done", async () => {
    const action = vi.fn(async () => ({ ran: true, tx: "0xtx" }));
    const check = vi.fn(async () => true);
    const complete = vi.fn(async () => true);
    const r = await runQuests(ctx({ "3": { address: "0xc0", signature: "function gm()", args: [], valueWei: "0" } }), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-zns"],
      getQuests: async () => [q({ id: "3", slug: "litvm-zns", type: "onchain", link: "https://zns.bio" })],
      check, complete, action,
    });
    expect(r["litvm-zns/Q"]).toBe("done");
    expect(action).toHaveBeenCalledOnce();
  });

  it("on-chain quest unmapped + check fails => unmapped", async () => {
    const r = await runQuests(ctx(), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-zns"],
      getQuests: async () => [q({ id: "4", slug: "litvm-zns", type: "onchain", link: "https://zns.bio" })],
      check: async () => false, complete: async () => true,
    });
    expect(r["litvm-zns/Q"]).toBe("unmapped");
  });

  it("dry-run previews without writing", async () => {
    const complete = vi.fn(async () => true);
    const r = await runQuests(ctx({}, true), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-arkada"],
      getQuests: async () => [q({ id: "5", slug: "litvm-arkada", type: "link" })],
      complete,
    });
    expect(r["litvm-arkada/Q"]).toBe("dry:link");
    expect(complete).not.toHaveBeenCalled();
  });
});
