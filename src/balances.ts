import { parseEther, type PublicClient } from "viem";

export async function getGas(client: PublicClient, address: `0x${string}`): Promise<bigint> {
  return client.getBalance({ address });
}
export async function hasMinGas(client: PublicClient, address: `0x${string}`, minEther: string): Promise<boolean> {
  return (await getGas(client, address)) >= parseEther(minEther);
}
