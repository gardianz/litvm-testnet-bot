export function buildSiweMessage(o: {
  domain: string; address: string; statement: string;
  uri: string; nonce: string; chainId: number; issuedAt?: string;
}): string {
  const issued = o.issuedAt ?? new Date().toISOString();
  return [
    `${o.domain} wants you to sign in with your Ethereum account:`,
    o.address, "",
    o.statement, "",
    `URI: ${o.uri}`,
    "Version: 1",
    `Chain ID: ${o.chainId}`,
    `Nonce: ${o.nonce}`,
    `Issued At: ${issued}`,
  ].join("\n");
}

export async function signSiwe(wallet: any, message: string): Promise<string> {
  return wallet.signMessage({ account: wallet.account, message });
}
