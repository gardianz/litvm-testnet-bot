import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type StepState = { lastRunUtcDay?: string; done?: boolean; txs?: string[]; data?: Record<string, unknown> };
type AccState = Record<string, StepState>;

export function utcDay(d: Date = new Date()): string { return d.toISOString().slice(0, 10); }
function file(id: string, dir: string) { return join(dir, `${id}.json`); }

export function loadState(id: string, dir = "state"): AccState {
  const f = file(id, dir);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as AccState) : {};
}
export function saveStepState(id: string, step: string, s: StepState, dir = "state"): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const st = loadState(id, dir);
  st[step] = { ...st[step], ...s };
  writeFileSync(file(id, dir), JSON.stringify(st, null, 2));
}
export function ranToday(state: AccState, step: string): boolean {
  return state[step]?.lastRunUtcDay === utcDay();
}
export function markRan(id: string, step: string, extra: Partial<StepState> = {}, dir = "state"): void {
  saveStepState(id, step, { lastRunUtcDay: utcDay(), ...extra }, dir);
}
