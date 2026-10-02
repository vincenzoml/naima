// The point this plugin declares: an adapter to a formal-methods tool. Any
// plugin contributes one under `contributes.verifiers`; `naima verify` runs
// the one a property names.

import { code, type Context, type ExtensionPoint, table } from "../../core/api.ts"

export interface VerifyRequest {
  /** Absolute path of the model or specification file. */
  model: string
  property: string
  options: Record<string, unknown>
}

export type Verdict = "holds" | "violated" | "error" | "unknown"

export interface VerifyResult {
  verdict: Verdict
  output: string
  counterexample?: string
}

/** An adapter to a formal-methods tool. */
export interface Verifier {
  id: string
  says: string
  /**
   * The external programs `verify` starts (a model checker, say), by name on PATH or by absolute path. The launcher
   * grants the program exactly these besides git; a program not declared here cannot be started under it.
   */
  runs?: string[]
  verify(request: VerifyRequest, ctx: Context): Promise<VerifyResult>
  /**
   * Every file a run on this request reads — the model and whatever it includes — as absolute paths. The run record
   * keeps one digest over all of them and the tool version, so a change to any of them makes the verdict stale.
   * Absent: the model alone.
   */
  inputs?(request: VerifyRequest, ctx: Context): string[] | Promise<string[]>
  /** The version of the tool a run uses, recorded with the run; a property run by another version is stale. Absent: none recorded. */
  version?(ctx: Context): string | Promise<string>
}

export const verifiersPoint: ExtensionPoint<Verifier> = {
  id: "verifiers",
  says:
    "an adapter to a formal-methods tool: `verify({ model, property, options }, ctx) → { verdict, output, counterexample? }`; optionally `inputs(request, ctx)`, every file a run reads, and `version(ctx)`, the tool's version, both kept in the run's digest",
  noun: "verifier",
  stored: true,
  key: (v) => v.id,
  renamed: (v, id) => ({ ...v, id }),
  validate: (v) => {
    const a = v as Partial<Verifier> | null
    if (!a || typeof a !== "object" || typeof a.id !== "string") return "has no id"
    if (typeof a.verify !== "function") return "has no verify function"
    for (const k of ["inputs", "version"] as const) if (a[k] !== undefined && typeof a[k] !== "function") return `has a ${k} that is not a function`
    return null
  },
  gaps: (v) => (typeof v.says === "string" && v.says.trim() ? [] : ["does not say what it checks"]),
  document: (vs) => ["", "**Verifiers**, used by `naima verify`", ...table(["Verifier", "What it checks"], vs.map((v) => [code(v.id), v.says]))],
}
