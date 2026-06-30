import { describe, it, expect, vi } from "vitest";
import { listQuests, verifyQuest } from "../src/arkada/client.js";

const A = { enabled: true, campaign: "litvm", apiBase: "https://api.arkada.gg", questsRoute: "/campaigns/{campaign}/quests", verifyRoute: "/quests/{id}/verify" } as any;

describe("arkada client", () => {
  it("returns [] when questsRoute unset", async () => {
    expect(await listQuests({ arkada: { enabled: true, campaign: "litvm" } as any, token: "t" })).toEqual([]);
  });
  it("lists + normalizes quests, substituting {campaign}", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ quests: [{ id: "1", slug: "gm", title: "GM", status: "completed", type: "daily" }] }) } as any);
    const qs = await listQuests({ arkada: A, token: "t", fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toContain("/campaigns/litvm/quests");
    expect(qs[0]).toMatchObject({ id: "1", slug: "gm", name: "GM", completed: true, daily: true });
  });
  it("verify substitutes {id} and reads success", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as any);
    expect(await verifyQuest({ arkada: A, token: "t", questId: "1", fetchImpl })).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toContain("/quests/1/verify");
  });
});
