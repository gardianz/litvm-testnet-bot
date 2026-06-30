import { describe, it, expect } from "vitest";
import { loadConfig, CHAIN_ID } from "../src/config.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function tmpCfg(yaml: string): string {
  const dir = mkdtempSync(join(tmpdir(), "litvm-"));
  const p = join(dir, "config.yaml");
  writeFileSync(p, yaml);
  return p;
}
const MIN = `evmRpc: "https://x"\nexplorerApi: "https://e"\nfaucetUrl: "https://f"\n`;

describe("loadConfig", () => {
  it("parses minimal config with defaults", () => {
    const c = loadConfig(tmpCfg(MIN));
    expect(c.chainId).toBe(CHAIN_ID);
    expect(c.dryRun).toBe(true);
    expect(c.faucet.daily).toBe(true);
    expect(c.arkada.apiBase).toBe("https://app-api.arkada.gg");
    expect(c.arkada.campaignPrefix).toBe("litvm");
    expect(c.steps.ecosystem).toBe(true);
    expect(c.steps.arkada).toBe(false);
    expect(c.ecosystem.dapps).toContain("zns-register");
    expect(c.questActions).toEqual({});
  });
  it("rejects unknown chainId", () => {
    expect(() => loadConfig(tmpCfg(MIN + `chainId: 999\n`))).toThrow();
  });
  it("parses a questActions entry", () => {
    const y = MIN + `questActions:\n  onchaingm:\n    address: "0xabc"\n    signature: "function gm()"\n`;
    const c = loadConfig(tmpCfg(y));
    expect(c.questActions.onchaingm.signature).toBe("function gm()");
  });
});
