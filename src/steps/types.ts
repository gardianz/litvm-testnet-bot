import type { Config } from "../config.js";
import type { Account } from "../accounts.js";
import type { StepState } from "../state.js";

export type StepResult = "done" | "skipped" | "ran";

export type Ctx = {
  cfg: Config;
  acc: Account;
  clients: { public: any; wallet: any; address: `0x${string}` };
  state: Record<string, StepState>;
  log: (m: string) => void;
  dryRun: boolean;
  report?: (key: string, status: string) => void;   // per-flow-step progress -> dashboard
};

export interface Step {
  name: string;
  enabled(cfg: Config): boolean;
  shouldRun(ctx: Ctx): Promise<boolean>;
  run(ctx: Ctx): Promise<StepResult>;
}
