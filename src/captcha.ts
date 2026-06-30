type SolveOpts = { apiKey: string; sitekey: string; pageurl: string; fetchImpl?: typeof fetch; pollMs?: number; maxPolls?: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function solveTurnstile(o: SolveOpts): Promise<string> {
  const f = o.fetchImpl ?? fetch;
  const pollMs = o.pollMs ?? 5000, maxPolls = o.maxPolls ?? 24;
  const inUrl = `https://2captcha.com/in.php?key=${o.apiKey}&method=turnstile&sitekey=${o.sitekey}&pageurl=${encodeURIComponent(o.pageurl)}&json=1`;
  const sub = await (await f(inUrl)).json();
  if (sub.status !== 1) throw new Error(`2captcha submit: ${sub.request}`);
  const id = sub.request;
  for (let i = 0; i < maxPolls; i++) {
    await sleep(pollMs);
    const res = await (await f(`https://2captcha.com/res.php?key=${o.apiKey}&action=get&id=${id}&json=1`)).json();
    if (res.status === 1) return res.request as string;
    if (res.request !== "CAPCHA_NOT_READY") throw new Error(`2captcha poll: ${res.request}`);
  }
  throw new Error("2captcha timeout");
}
