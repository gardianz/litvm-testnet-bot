import { describe, it, expect, vi } from "vitest";
import { summarize, sendTelegram } from "../src/reporter.js";

describe("reporter", () => {
  it("summarizes per account", () => {
    const s = summarize([{ acc: "acc1", steps: { faucet: "ran", "arkada-quests": "ran" } }]);
    expect(s).toContain("acc1");
    expect(s).toContain("faucet");
  });
  it("sendTelegram no-op without env", async () => {
    expect(await sendTelegram("hi", vi.fn() as any)).toBe(false);
  });
});
