import "dotenv/config";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "./config.js";
import { loadAccounts, appendAccounts, type Account } from "./accounts.js";
import { runAll } from "./runner.js";
import { makeClients } from "./evm.js";
import { getGas } from "./balances.js";
import { loadState } from "./state.js";
import { summarize, sendTelegram } from "./reporter.js";
import { startDaemon, startCron } from "./scheduler.js";

export function parseArgs(argv: string[]) {
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
  return {
    gen: has("--gen") ? Number(val("--gen") ?? "1") : undefined,
    check: has("--check"),
    dryRun: has("--no-dry-run") ? false : true,
    daemon: has("--daemon"),
    schedule: has("--schedule"),
    only: val("--step"),
    account: val("--account"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.ACCOUNTS_KEY;

  if (args.gen !== undefined) {
    for (const a of appendAccounts("accounts.json", args.gen, key)) console.log(`${a.id}: ${privateKeyToAccount(a.pk).address}`);
    return;
  }

  const cfg = loadConfig();
  let accounts = loadAccounts("accounts.json", key);
  if (args.account) accounts = accounts.filter((a: Account) => a.id === args.account);

  if (args.check) {
    for (const a of accounts) {
      const { public: pc, address } = makeClients(cfg, a);
      const gas = await getGas(pc, address).catch(() => 0n);
      console.log(`${a.id} ${address} gas=${formatEther(gas)} state=${JSON.stringify(loadState(a.id))}`);
    }
    return;
  }

  const runOnce = async () => {
    const results = await runAll(cfg, accounts, { dryRun: args.dryRun, only: args.only });
    const text = summarize(results);
    console.log(text);
    await sendTelegram(`LitVM bot run\n${text}`).catch(() => {});
  };

  if (args.daemon) { startDaemon(runOnce, cfg); return; }
  if (args.schedule) { startCron(runOnce, cfg.scheduleCron); return; }
  await runOnce();
}

if (process.argv[1] && process.argv[1].endsWith("main.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
