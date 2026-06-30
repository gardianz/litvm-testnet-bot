import { describe, it, expect } from "vitest";
import { utcDay, ranToday, markRan, loadState } from "../src/state.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("state", () => {
  it("utcDay is YYYY-MM-DD", () => {
    expect(utcDay(new Date("2026-06-30T23:00:00Z"))).toBe("2026-06-30");
  });
  it("ranToday flips after markRan", () => {
    const dir = mkdtempSync(join(tmpdir(), "st-"));
    expect(ranToday(loadState("acc1", dir), "faucet")).toBe(false);
    markRan("acc1", "faucet", { txs: ["0xabc"] }, dir);
    expect(ranToday(loadState("acc1", dir), "faucet")).toBe(true);
  });
});
