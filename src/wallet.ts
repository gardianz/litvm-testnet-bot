import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export function genWallet(): { privateKey: `0x${string}`; address: `0x${string}` } {
  const privateKey = generatePrivateKey();
  return { privateKey, address: privateKeyToAccount(privateKey).address };
}
