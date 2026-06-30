import { describe, it, expect } from "vitest";
import { genWallet } from "../src/wallet.js";
import { encrypt, decrypt } from "../src/crypto.js";
import { loadAccounts } from "../src/accounts.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("wallet/accounts", () => {
  it("generates valid pk + address", () => {
    const w = genWallet();
    expect(w.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(w.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
  it("encrypt/decrypt round-trips", () => {
    const blob = encrypt("hello", "pw");
    expect(blob).not.toContain("hello");
    expect(decrypt(blob, "pw")).toBe("hello");
  });
  it("loads plain JSON accounts", () => {
    const p = join(mkdtempSync(join(tmpdir(), "acc-")), "accounts.json");
    const w = genWallet();
    writeFileSync(p, JSON.stringify([{ id: "acc1", pk: w.privateKey }]));
    expect(loadAccounts(p)[0].pk).toBe(w.privateKey);
  });
  it("loads encrypted accounts blob", () => {
    const p = join(mkdtempSync(join(tmpdir(), "acc-")), "accounts.json");
    const w = genWallet();
    writeFileSync(p, JSON.stringify(encrypt(JSON.stringify([{ id: "acc1", pk: w.privateKey }]), "pw")));
    expect(loadAccounts(p, "pw")[0].pk).toBe(w.privateKey);
  });
});
