import type { Config } from "../config.js";
import { parseChecks } from "./onchain.js";

export type Quest = { id: string; slug: string; name: string; type: string; link: string; optional: boolean; targets: string[]; minCount: number };
type Ar = Config["arkada"];

function H(token: string) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "Mozilla/5.0" };
}

// litvm hub = every campaign whose slug starts with arkada.campaignPrefix.
export async function listCampaignSlugs(arkada: Ar, token: string, fetchImpl?: typeof fetch): Promise<string[]> {
  if (!arkada.apiBase) return [];
  const f = fetchImpl ?? fetch;
  const res = await f(`${arkada.apiBase}/campaigns?limit=300`, { headers: H(token) });
  if (!res.ok) return [];
  const j: any = await res.json().catch(() => ({}));
  const arr: any[] = Array.isArray(j) ? j : j.data ?? j.campaigns ?? j.items ?? [];
  return arr.map((c) => String(c.slug ?? "")).filter((s) => s.startsWith(arkada.campaignPrefix));
}

export async function getQuests(arkada: Ar, slug: string, token: string, fetchImpl?: typeof fetch): Promise<Quest[]> {
  if (!arkada.apiBase) return [];
  const f = fetchImpl ?? fetch;
  const res = await f(`${arkada.apiBase}/campaigns/${slug}`, { headers: H(token) });
  if (!res.ok) return [];
  const j: any = await res.json().catch(() => ({}));
  const raw: any[] = j.quests ?? j.campaign?.quests ?? [];
  return raw.map((q) => {
    const { targets, minCount } = parseChecks(q.value);
    return {
      id: String(q.id ?? ""),
      slug,
      name: String(q.name ?? q.title ?? ""),
      type: String(q.quest_type ?? q.type ?? ""),
      link: String(q.link ?? q.url ?? ""),
      optional: q.optional === true,
      targets,
      minCount,
    };
  });
}

// POST /quests/check-quest {id} -> true when Arkada's monitor confirms the action (422 otherwise).
export async function checkQuest(arkada: Ar, id: string, token: string, fetchImpl?: typeof fetch): Promise<boolean> {
  if (!arkada.apiBase) return false;
  const f = fetchImpl ?? fetch;
  const res = await f(`${arkada.apiBase}/quests/check-quest`, { method: "POST", headers: H(token), body: JSON.stringify({ id }) });
  return res.ok;
}

// POST /quests/complete-quest {id} -> isCompleted. Returns true on success.
export async function completeQuest(arkada: Ar, id: string, token: string, fetchImpl?: typeof fetch): Promise<boolean> {
  if (!arkada.apiBase) return false;
  const f = fetchImpl ?? fetch;
  const res = await f(`${arkada.apiBase}/quests/complete-quest`, { method: "POST", headers: H(token), body: JSON.stringify({ id }) });
  if (!res.ok) return false;
  const j: any = await res.json().catch(() => ({}));
  return j.isCompleted === true || j.id != null;
}

export function isSocial(link: string, type = ""): boolean {
  return /(x\.com|twitter\.com|discord\.|discord\.gg|t\.me|telegram)/i.test(link)
    || /(twitter|discord|telegram|tweet|retweet)/i.test(type);
}
