// Command-line arguments, on top of node:util's parser.

import { parseArgs } from "node:util"
import { NaimaError } from "./errors.ts"
import type { Command } from "./types.ts"

export type Flags = Record<string, { type: "string" | "boolean"; multiple?: boolean; short?: string }>

export interface Parsed {
  positionals: string[]
  values: Record<string, string | boolean | (string | boolean)[] | undefined>
}

export function parse(args: string[], flags: Flags = {}): Parsed {
  try {
    const { positionals, values } = parseArgs({ args, options: flags, allowPositionals: true, strict: true })
    return { positionals, values }
  } catch (e) {
    // node:util throws a TypeError, with a code, for a flag it does not know or a
    // flag missing its value: that is a mistake in the command line, not a bug, and
    // it is reported as a usage error rather than an internal one.
    const code = (e as { code?: unknown } | null)?.code
    if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_")) throw new NaimaError((e as Error).message, "usage")
    throw e
  }
}

export const str = (p: Parsed, name: string): string | undefined => {
  const v = p.values[name]
  return typeof v === "string" ? v : undefined
}

export const strs = (p: Parsed, name: string): string[] => {
  const v = p.values[name]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []
}

export const bool = (p: Parsed, name: string): boolean => p.values[name] === true

/** Split `field=value` pairs. */
export function pairs(list: string[]): [string, string][] {
  return list.map((pair) => {
    const at = pair.indexOf("=")
    if (at < 1) throw new Error(`"${pair}" is not field=value`)
    return [pair.slice(0, at), pair.slice(at + 1)]
  })
}

/** A count from the command line: `fallback` when absent, else a positive whole number, or a usage error naming `what`. */
export function positiveInt(raw: string | undefined, fallback: number, what: string): number {
  if (raw === undefined) return fallback
  if (!/^\d+$/.test(raw) || Number(raw) < 1) throw new NaimaError(`${what}: the count must be a positive whole number, got ${JSON.stringify(raw)}`)
  return Number(raw)
}

/** The error a command throws when it is misused: its own usage line, the one place that line is spelled. */
export const usageError = (cmd: Pick<Command, "usage">): NaimaError => new NaimaError(`usage: naima ${cmd.usage}`, "usage")
