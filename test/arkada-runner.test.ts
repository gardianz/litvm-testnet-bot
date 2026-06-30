import { describe, it, expect, vi } from "vitest";
import { runQuests } from "../src/arkada/runner.js";

function ctx(actions: any = {}, dryRun = false): any {
  return {
    cfg: { arkada: { enabled: true, apiBase: "https://app-api.arkada.gg", campaignPrefix: "litvm", skipSocial: true, includeDaily: true, onchain: true }, questActions: actions, chainId: 4441, explorerApi: "https://e" },
    acc: { id: "acc1" }, state: {}, dryRun, log: () => {},
    clients: { wallet: { signMessage: async () => "0xsig", account: { address: "0xabc" } }, public: {}, address: "0xabc" },
  };
}
const q = (o: any) => ({ id: o.id, slug: o.slug ?? "litvm-x", name: o.name ?? "Q", type: o.type ?? "link", link: o.link ?? "https://lester-labs.com", optional: false, targets: o.targets ?? [], minCount: o.minCount ?? 1 });

describe("runQuests", () => {
  it("no-login when login fails", async () => {
    expect(await runQuests(ctx(), { login: async () => null })).toEqual({ arkada: "no-login" });
  });

  it("link quest (no targets) -> complete directly => done", async () => {
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

  it("social quest skipped (no targets)", async () => {
    const r = await runQuests(ctx(), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-lester"],
      getQuests: async () => [q({ id: "2", slug: "litvm-lester", type: "twitter", link: "https://x.com/foo" })],
      complete: async () => true,
    });
    expect(r["litvm-lester/Q"]).toBe("social-skip");
  });

  it("on-chain quest: fulfil -> check passes -> complete => done-onchain", async () => {
    const onchain = vi.fn(async () => ({ ok: true, sent: 1, txs: ["0xtx"] }));
    const check = vi.fn(async () => true);
    const complete = vi.fn(async () => true);
    const r = await runQuests(ctx(), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-sweep"],
      getQuests: async () => [q({ id: "3", slug: "litvm-sweep", targets: ["0xC0"], minCount: 1 })],
      onchain, check, complete,
    });
    expect(r["litvm-sweep/Q"]).toBe("done-onchain");
    expect(onchain).toHaveBeenCalledOnce();
  });

  it("on-chain quest that reverts on replay => onchain-fail", async () => {
    const onchain = vi.fn(async () => ({ ok: false, sent: 0, reason: "revert", txs: [] }));
    const r = await runQuests(ctx(), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-litvmswap"],
      getQuests: async () => [q({ id: "4", slug: "litvm-litvmswap", targets: ["0xC0"], minCount: 5 })],
      onchain, check: async () => false, complete: async () => true,
    });
    expect(r["litvm-litvmswap/Q"]).toBe("onchain-fail:revert(0)");
  });

  it("dry-run previews on-chain quests without sending", async () => {
    const onchain = vi.fn();
    const r = await runQuests(ctx({}, true), {
      login: async () => ({ token: "t" }),
      listSlugs: async () => ["litvm-sweep"],
      getQuests: async () => [q({ id: "5", slug: "litvm-sweep", targets: ["0xC0"], minCount: 3 })],
      onchain, complete: async () => true,
    });
    expect(r["litvm-sweep/Q"]).toBe("dry:onchain x3");
    expect(onchain).not.toHaveBeenCalled();
  });
});
