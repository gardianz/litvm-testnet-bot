import { parseAbi, encodeFunctionData, type PublicClient } from "viem";

export const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
]);

export async function balanceOf(pub: PublicClient, token: `0x${string}`, owner: `0x${string}`): Promise<bigint> {
  return pub.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] }) as Promise<bigint>;
}

export async function allowance(pub: PublicClient, token: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`): Promise<bigint> {
  return pub.readContract({ address: token, abi: ERC20_ABI, functionName: "allowance", args: [owner, spender] }) as Promise<bigint>;
}

export function approveTx(token: `0x${string}`, spender: `0x${string}`, amount: bigint) {
  return { to: token, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender, amount] }), value: 0n };
}

// returns an approve tx only when current allowance < amount, else null
export async function ensureAllowance(
  pub: PublicClient, token: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`, amount: bigint,
): Promise<{ to: `0x${string}`; data: `0x${string}`; value: bigint } | null> {
  if ((await allowance(pub, token, owner, spender)) >= amount) return null;
  return approveTx(token, spender, amount);
}
