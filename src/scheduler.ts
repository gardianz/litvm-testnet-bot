import cron from "node-cron";
import type { Config } from "./config.js";

export function nextDelayMs(minHours: number, maxHours: number, rnd: () => number = Math.random): number {
  return Math.floor((minHours + (maxHours - minHours) * rnd()) * 3600 * 1000);
}
export function startCron(run: () => Promise<void>, cronExpr: string): void {
  cron.schedule(cronExpr, () => { run().catch((e) => console.error(e)); });
  console.log(`scheduled: ${cronExpr}`);
}
export function startDaemon(run: () => Promise<void>, cfg: Config): void {
  const loop = async () => {
    await run().catch((e) => console.error(e));
    const delay = nextDelayMs(cfg.daemon.minHours, cfg.daemon.maxHours);
    console.log(`next run in ${(delay / 3600000).toFixed(2)}h`);
    setTimeout(loop, delay);
  };
  loop();
}
