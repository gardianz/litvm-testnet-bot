import { existsSync, readFileSync } from "node:fs";
import { ProxyAgent, type Dispatcher } from "undici";
import { SocksProxyAgent } from "socks-proxy-agent";

export function loadProxies(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => (/^(https?|socks\d?):\/\//.test(l) ? l : `http://${l}`));
}
export function proxyForIndex(proxies: string[], idx: number): string | undefined {
  return proxies[idx];
}
export function dispatcherFor(proxy?: string): Dispatcher | undefined {
  if (!proxy) return undefined;
  if (proxy.startsWith("socks")) return new SocksProxyAgent(proxy) as unknown as Dispatcher;
  return new ProxyAgent(proxy);
}
