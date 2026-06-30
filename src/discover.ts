const TIMEOUT_MS = 15000;

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return await r.json();
  } catch {
    return null;
  }
}

export async function getAbi(explorerApi: string, address: string): Promise<any[] | null> {
  const r = await getJson(`${explorerApi}/api?module=contract&action=getabi&address=${address}`);
  if (r && r.status === "1" && r.result) { try { return JSON.parse(r.result); } catch { return null; } }
  return null;
}
export async function recentTxs(explorerApi: string, address: string, n = 10): Promise<any[]> {
  const r = await getJson(`${explorerApi}/api?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=${n}`);
  return r && Array.isArray(r.result) ? r.result : [];
}
