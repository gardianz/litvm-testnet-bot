import type { StepResult } from "./steps/types.js";

// Live TTY dashboard (forge-style): per-account gas + pipeline-step grid + log tail.
// Auto-disables on a non-TTY (cron / redirected output) → falls back to line logs.

const C = { reset: "\x1b[0m", dim: "\x1b[2m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m" };
const STEP_COLS = ["register", "faucet", "ecosystem", "arkada-quests"] as const;

type Row = { gas: string; steps: Record<string, StepResult | "…"> };

export class Dashboard {
  private rows = new Map<string, Row>();
  private logs: string[] = [];
  readonly enabled: boolean;

  constructor(enabled: boolean, private title = "LitVM ecosystem bot", private live = true) {
    this.enabled = enabled && !!process.stdout.isTTY;
  }

  ensure(id: string) { if (!this.rows.has(id)) this.rows.set(id, { gas: "…", steps: {} }); }
  setGas(id: string, gas: string) { this.ensure(id); this.rows.get(id)!.gas = gas; this.render(); }
  setStep(id: string, step: string, r: StepResult | "…") { this.ensure(id); this.rows.get(id)!.steps[step] = r; this.render(); }

  log(line: string) {
    this.logs.push(line);
    if (this.logs.length > 12) this.logs.shift();
    if (!this.enabled) { console.log(line); return; }
    this.render();
  }

  private mark(v?: string) {
    if (!v || v === "…") return `${C.dim}·${C.reset}`;
    if (v === "ran" || v === "done") return `${C.green}✓${C.reset}`;
    if (v === "skipped") return `${C.dim}–${C.reset}`;
    return `${C.yellow}${v}${C.reset}`;
  }

  render() {
    if (!this.enabled) return;
    const out: string[] = [];
    out.push(`${C.bold}${C.cyan}${this.title}${C.reset}  ${this.live ? C.red + "LIVE" : C.dim + "dry"}${C.reset}  chain 4441  ${C.dim}${new Date().toLocaleTimeString()}${C.reset}`);
    out.push("");
    out.push(`${C.dim}acct        gas         ${STEP_COLS.map((s) => s.slice(0, 9).padEnd(10)).join("")}${C.reset}`);
    for (const [id, r] of this.rows) {
      const cells = STEP_COLS.map((s) => this.mark(r.steps[s]).padEnd(10 + 9)).join("");
      out.push(`${id.padEnd(11)} ${r.gas.slice(0, 10).padEnd(11)} ${cells}`);
    }
    out.push("");
    out.push(`${C.dim}── log ──${C.reset}`);
    for (const l of this.logs) out.push(`${C.dim}${l.slice(0, (process.stdout.columns || 100) - 1)}${C.reset}`);
    process.stdout.write("\x1b[2J\x1b[H" + out.join("\n") + "\n");
  }
}
