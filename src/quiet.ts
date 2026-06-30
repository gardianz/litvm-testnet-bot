import pino from "pino";
export function mkLogger(tag: string) {
  return pino({ transport: { target: "pino-pretty", options: { colorize: true } } }).child({ tag });
}
export function line(msg: string) { console.log(msg); }
