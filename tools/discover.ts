import { loadConfig } from "../src/config.js";
import { getAbi, recentTxs } from "../src/discover.js";

const addr = process.argv[2];
if (!addr) { console.error("usage: npm run discover -- <address>"); process.exit(1); }
const cfg = loadConfig();
const abi = await getAbi(cfg.explorerApi, addr);
if (abi) {
  const fns = abi.filter((x: any) => x.type === "function").map((x: any) => `${x.name}(${(x.inputs ?? []).map((i: any) => i.type).join(",")})`);
  console.log(`VERIFIED ${addr}\nfunctions:\n  ${fns.join("\n  ")}`);
} else {
  console.log(`NOT verified / no ABI for ${addr}`);
}
const txs = await recentTxs(cfg.explorerApi, addr, 5);
console.log(`recent tx selectors: ${txs.map((t: any) => (t.input ?? "0x").slice(0, 10)).join(", ")}`);
