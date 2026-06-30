export function summarize(results: { acc: string; steps: Record<string, string> }[]): string {
  return results.map((r) => `${r.acc}: ` + Object.entries(r.steps).map(([k, v]) => `${k}=${v}`).join(" ")).join("\n");
}
export async function sendTelegram(text: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const r = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
  });
  return r.ok;
}
