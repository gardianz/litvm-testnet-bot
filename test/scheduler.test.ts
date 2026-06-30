import { describe, it, expect } from "vitest";
import { nextDelayMs } from "../src/scheduler.js";

describe("scheduler", () => {
  it("mid at rnd=0.5", () => { expect(nextDelayMs(22, 26, () => 0.5)).toBe(24 * 3600 * 1000); });
  it("min at rnd=0", () => { expect(nextDelayMs(22, 26, () => 0)).toBe(22 * 3600 * 1000); });
});
