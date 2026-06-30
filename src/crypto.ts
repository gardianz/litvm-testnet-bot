import CryptoJS from "crypto-js";

export function encrypt(plain: string, key: string): string {
  return CryptoJS.AES.encrypt(plain, key).toString();
}
export function decrypt(blob: string, key: string): string {
  const out = CryptoJS.AES.decrypt(blob, key).toString(CryptoJS.enc.Utf8);
  if (!out) throw new Error("decrypt failed (wrong ACCOUNTS_KEY?)");
  return out;
}
