import { describe, it, expect, vi } from "vitest";
import { listCampaignSlugs, getQuests, checkQuest, completeQuest, isSocial } from "../src/arkada/client.js";

const A = { enabled: true, apiBase: "https://app-api.arkada.gg", campaignPrefix: "litvm" } as any;

describe("arkada client", () => {
  it("listCampaignSlugs filters by prefix", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ([{ slug: "litvm-lester" }, { slug: "other-x" }, { slug: "litvm-zns-daily" }]) } as any);
    const slugs = await listCampaignSlugs(A, "t", fetchImpl);
    expect(slugs).toEqual(["litvm-lester", "litvm-zns-daily"]);
    expect(fetchImpl.mock.calls[0][0]).toContain("/campaigns?limit=300");
  });
  it("getQuests normalizes fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ quests: [{ id: "1", name: "Mint", quest_type: "link", link: "https://x", optional: false }] }) } as any);
    const qs = await getQuests(A, "litvm-lester", "t", fetchImpl);
    expect(qs[0]).toMatchObject({ id: "1", slug: "litvm-lester", name: "Mint", type: "link", link: "https://x", targets: [], minCount: 1 });
  });
  it("checkQuest true on ok, false on 422", async () => {
    expect(await checkQuest(A, "1", "t", vi.fn().mockResolvedValueOnce({ ok: true } as any))).toBe(true);
    expect(await checkQuest(A, "1", "t", vi.fn().mockResolvedValueOnce({ ok: false, status: 422 } as any))).toBe(false);
  });
  it("completeQuest reads isCompleted", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ isCompleted: true }) } as any);
    expect(await completeQuest(A, "1", "t", fetchImpl)).toBe(true);
  });
  it("isSocial detects x.com / discord / t.me", () => {
    expect(isSocial("https://x.com/foo")).toBe(true);
    expect(isSocial("https://discord.gg/x")).toBe(true);
    expect(isSocial("https://lester-labs.com/launch")).toBe(false);
  });
});
