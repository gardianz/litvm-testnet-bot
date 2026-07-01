import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/main.js";

describe("parseArgs", () => {
  it("defaults dryRun undefined (uses config)", () => { expect(parseArgs([]).dryRun).toBeUndefined(); });
  it("--no-dry-run forces live", () => { expect(parseArgs(["--no-dry-run"]).dryRun).toBe(false); });
  it("--dry-run forces dry", () => { expect(parseArgs(["--dry-run"]).dryRun).toBe(true); });
  it("--gen N", () => { expect(parseArgs(["--gen", "5"]).gen).toBe(5); });
  it("--account + --step", () => {
    const a = parseArgs(["--account", "acc2", "--step", "arkada-quests"]);
    expect(a.account).toBe("acc2");
    expect(a.only).toBe("arkada-quests");
  });
});
