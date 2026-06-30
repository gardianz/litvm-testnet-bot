import { describe, it, expect } from "vitest";
import { loadProxies, proxyForIndex } from "../src/proxies.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("proxies", () => {
  it("parses, skips comments/blanks, normalizes bare host:port", () => {
    const p = join(mkdtempSync(join(tmpdir(), "px-")), "proxy.txt");
    writeFileSync(p, "# c\n\nhttp://u:p@1.2.3.4:8080\n9.9.9.9:3128\n");
    const list = loadProxies(p);
    expect(list).toEqual(["http://u:p@1.2.3.4:8080", "http://9.9.9.9:3128"]);
    expect(proxyForIndex(list, 1)).toBe("http://9.9.9.9:3128");
    expect(proxyForIndex(list, 5)).toBeUndefined();
  });
});
