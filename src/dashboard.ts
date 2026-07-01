// Live TTY dashboard (forge-style): per-account gas + a column per ecosystem dApp
// showing done/total steps, + a log tail. Auto-disables on a non-TTY → line logs.

const C = { reset: "\x1b[0m", dim: "\x1b[2m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m" };

// a flow step is "done" when it produced a tx / was already satisfied
function isDone(status: string): boolean {
  return /^0x/.test(status) || /done|daily-done|already/.test(status);
}
function isFail(status: string): boolean {
  return /revert|fail|no-replay|no-target/.test(status);
}

type Row = { gas: string; flows: Record<string, string> }; // flows keyed "dapp.step"

export class Dashboard {
  private rows = new Map<string, Row>();
  private logs: string[] = [];
  readonly enabled: boolean;

  constructor(enabled: boolean, private dapps: string[], private title = "LitVM ecosystem bot", private live = true) {
    this.enabled = enabled && !!process.stdout.isTTY;
  }

  ensure(id: string) { if (!this.rows.has(id)) this.rows.set(id, { gas: "…", flows: {} }); }
  setGas(id: string, gas: string) { this.ensure(id); this.rows.get(id)!.gas = gas; this.render(); }
  setStep(_id: string, _step: string, _r: string) { /* pipeline-step granularity unused; see setFlow */ }
  setFlow(id: string, key: string, status: string) { this.ensure(id); this.rows.get(id)!.flows[key] = status; this.render(); }

  log(line: string) {
    this.logs.push(line);
    if (this.logs.length > 10) this.logs.shift();
    if (!this.enabled) { console.log(line); return; }
    this.render();
  }

  private readonly CW = 12; // column width per dApp

  // aggregate a dApp's steps -> colored "done/total" padded to CW (color codes don't count)
  private cell(row: Row, dapp: string): string {
    const entries = Object.entries(row.flows).filter(([k]) => k.startsWith(dapp + "."));
    if (!entries.length) return `${C.dim}·${C.reset}`.padEnd(this.CW + C.dim.length + C.reset.length);
    const total = entries.length;
    const done = entries.filter(([, s]) => isDone(s)).length;
    const fail = entries.some(([, s]) => isFail(s));
    const col = done === total ? C.green : fail ? C.yellow : C.dim;
    const txt = `${done}/${total}`;
    return `${col}${txt}${C.reset}` + " ".repeat(Math.max(0, this.CW - txt.length));
  }

  render() {
    if (!this.enabled) return;
    const w = (process.stdout.columns || 120) - 1;
    const out: string[] = [];
    out.push(`${C.bold}${C.cyan}${this.title}${C.reset}  ${this.live ? C.red + "LIVE" : C.dim + "dry"}${C.reset}  chain 4441  ${C.dim}${new Date().toLocaleTimeString()}${C.reset}`);
    out.push("");
    out.push(`${C.dim}${"acct".padEnd(10)} ${"gas".padEnd(12)} ${this.dapps.map((d) => d.slice(0, this.CW - 1).padEnd(this.CW)).join("")}${C.reset}`);
    for (const [id, r] of this.rows) {
      out.push(`${id.padEnd(10)} ${r.gas.slice(0, 11).padEnd(12)} ${this.dapps.map((d) => this.cell(r, d)).join("")}`);
    }
    out.push("");
    out.push(`${C.dim}── log ──${C.reset}`);
    for (const l of this.logs) out.push(`${C.dim}${l.slice(0, w)}${C.reset}`);
    process.stdout.write("\x1b[2J\x1b[H" + out.join("\n") + "\n");
  }
}
