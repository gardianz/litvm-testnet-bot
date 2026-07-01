// Interactive CLI menu — run everything without memorising commands.
//   npm start   (or: node tools/menu.mjs)
import "dotenv/config";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const C = { reset: "\x1b[0m", cyan: "\x1b[36m", bold: "\x1b[1m", dim: "\x1b[2m", green: "\x1b[32m", yellow: "\x1b[33m" };
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);
const run = (cmd) => { console.log(`${C.dim}$ ${cmd}${C.reset}`); spawnSync(cmd, { shell: true, stdio: "inherit" }); };

function status() {
  const acc = existsSync("accounts.json") ? (() => { try { const d = JSON.parse(readFileSync("accounts.json", "utf8")); return Array.isArray(d) ? d.length : "encrypted"; } catch { return "?"; } })() : 0;
  const cfg = existsSync("config.yaml") ? "yes" : `${C.yellow}missing (cp config.example.yaml config.yaml)${C.reset}`;
  const proxies = existsSync("proxy.txt") ? readFileSync("proxy.txt", "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length : 0;
  const cap = process.env.CAPTCHA_API_KEY ? "set" : `${C.yellow}unset (.env)${C.reset}`;
  return `${C.dim}accounts: ${acc} · config.yaml: ${cfg} · proxies: ${proxies} · CAPTCHA_API_KEY: ${cap}${C.reset}`;
}

const MENU = `
${C.bold}${C.cyan}=== LitVM Ecosystem Bot ===${C.reset}
${status()}

  ${C.bold}Setup${C.reset}
   1) Generate wallets
   2) Check balances + status

  ${C.bold}Faucet (gas)${C.reset}
   3) Claim faucet once (all accounts)
   4) Faucet loop — every 3 hours
   5) Faucet loop — custom interval

  ${C.bold}Run bot${C.reset}
   6) Run ecosystem once (LIVE)
   7) Run daemon 24/7 (LIVE + dashboard)
   8) Dry-run preview (no broadcast)

   0) Exit
`;

for (;;) {
  console.clear();
  console.log(MENU);
  const c = (await ask("Pilih [0-8]: ")).trim();
  console.log("");
  if (c === "0" || c.toLowerCase() === "q") break;
  else if (c === "1") { const n = (await ask("Jumlah wallet baru: ")).trim() || "1"; run(`npm run gen -- ${Number(n) || 1}`); }
  else if (c === "2") run("npm run check");
  else if (c === "3") run("npm run faucet");
  else if (c === "4") { console.log(`${C.green}Faucet tiap 3 jam per akun (Ctrl+C untuk stop)${C.reset}`); run("node tools/faucet-claim.mjs --loop --hours 3"); }
  else if (c === "5") { const h = (await ask("Interval jam (mis. 2): ")).trim() || "3"; run(`node tools/faucet-claim.mjs --loop --hours ${Number(h) || 3}`); }
  else if (c === "6") run("npm run bot:live");
  else if (c === "7") { console.log(`${C.green}Daemon 24/7 LIVE (Ctrl+C untuk stop)${C.reset}`); run("npm run daemon"); }
  else if (c === "8") run("npm run bot:dry");
  else { console.log(`${C.yellow}Pilihan tidak valid.${C.reset}`); }
  if (c !== "0") await ask(`\n${C.dim}[Enter untuk kembali ke menu]${C.reset}`);
}
rl.close();
console.log("bye.");
