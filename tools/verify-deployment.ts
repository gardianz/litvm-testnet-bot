import { createPublicClient, http } from "viem";
import { loadConfig } from "../src/config.js";
import { defineLiteforge } from "../src/evm.js";

const cfg = loadConfig();
const client = createPublicClient({ chain: defineLiteforge(cfg.evmRpc), transport: http(cfg.evmRpc) });
const id = await client.getChainId();
console.log(`chainId=${id} ${id === 4441 ? "OK" : "WRONG"}`);
console.log(`arkada.apiBase=${cfg.arkada.apiBase ?? "(unset)"} questActions=${Object.keys(cfg.questActions).length}`);
console.log(`registerApi=${cfg.registerApi ?? "(unset)"} faucetEndpoint=${cfg.faucetEndpoint ?? "(unset)"}`);
