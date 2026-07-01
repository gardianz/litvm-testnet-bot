import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { decrypt, encrypt } from "./crypto.js";
import { genWallet } from "./wallet.js";

export type Account = { id: string; pk: `0x${string}`; proxy?: string };

export function loadAccounts(path = "accounts.json", key?: string): Account[] {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed === "string") {
    if (!key) throw new Error("accounts.json is encrypted but ACCOUNTS_KEY is unset");
    return JSON.parse(decrypt(parsed, key)) as Account[];
  }
  return parsed as Account[];
}

// key decrypts an existing (encrypted) file on read; the file is written encrypted
// only when doEncrypt is true (opt-in). Otherwise it stays plain, readable JSON.
export function appendAccounts(path = "accounts.json", n: number, key?: string, doEncrypt = false): Account[] {
  let existing: Account[] = [];
  if (existsSync(path)) existing = loadAccounts(path, key);
  const created: Account[] = [];
  for (let i = 0; i < n; i++) {
    const w = genWallet();
    created.push({ id: `acc${existing.length + i + 1}`, pk: w.privateKey });
  }
  const all = [...existing, ...created];
  const enc = doEncrypt && key;
  writeFileSync(path, enc ? JSON.stringify(encrypt(JSON.stringify(all), key)) : JSON.stringify(all, null, 2));
  return created;
}
