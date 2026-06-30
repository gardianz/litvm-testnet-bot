import type { Config } from "../config.js";

export type Quest = { id: string; slug: string; name: string; completed: boolean; daily: boolean };
type Base = { arkada: Config["arkada"]; token: string; fetchImpl?: typeof fetch };

function auth(token: string) { return { authorization: `Bearer ${token}`, "content-type": "application/json" }; }
function sub(route: string, vars: Record<string, string>) {
  return route.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export async function listQuests(o: Base): Promise<Quest[]> {
  const a = o.arkada;
  if (!a.apiBase || !a.questsRoute) return [];
  const f = o.fetchImpl ?? fetch;
  const url = `${a.apiBase}${sub(a.questsRoute, { campaign: a.campaign })}`;
  const res = await f(url, { headers: auth(o.token) });
  if (!res.ok) return [];
  const j: any = await res.json().catch(() => ({}));
  const raw: any[] = j.quests ?? j.data?.quests ?? j.data ?? (Array.isArray(j) ? j : []);
  return raw.map((q) => ({
    id: String(q.id ?? q.questId ?? q._id ?? ""),
    slug: String(q.slug ?? q.key ?? q.code ?? q.id ?? ""),
    name: String(q.name ?? q.title ?? q.slug ?? ""),
    completed: q.completed === true || q.status === "completed" || q.isCompleted === true || q.claimed === true,
    daily: q.daily === true || q.type === "daily" || q.frequency === "daily",
  }));
}

export async function verifyQuest(o: Base & { questId: string }): Promise<boolean> {
  const a = o.arkada;
  if (!a.apiBase || !a.verifyRoute) return false;
  const f = o.fetchImpl ?? fetch;
  const res = await f(`${a.apiBase}${sub(a.verifyRoute, { id: o.questId })}`, {
    method: "POST", headers: auth(o.token), body: JSON.stringify({ questId: o.questId }),
  });
  if (!res.ok) return false;
  const j: any = await res.json().catch(() => ({}));
  return j.success !== false && !j.error;
}

export async function claimQuest(o: Base & { questId: string }): Promise<boolean> {
  const a = o.arkada;
  if (!a.apiBase || !a.claimRoute) return false;
  const f = o.fetchImpl ?? fetch;
  const res = await f(`${a.apiBase}${sub(a.claimRoute, { id: o.questId })}`, {
    method: "POST", headers: auth(o.token), body: JSON.stringify({ questId: o.questId }),
  });
  if (!res.ok) return false;
  const j: any = await res.json().catch(() => ({}));
  return j.success !== false && !j.error;
}
