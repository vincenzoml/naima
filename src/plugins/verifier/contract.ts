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
}

export const verifiersPoint: ExtensionPoint<Verifier> = {
  id: "verifiers",
  says: "an adapter to a formal-methods tool: `verify({ model, property, options }, ctx) → { verdict, output, counterexample? }`",
  noun: "verifier",
  stored: true,
  key: (v) => v.id,
  renamed: (v, id) => ({ ...v, id }),
  validate: (v) => {
    const a = v as Partial<Verifier> | null
    if (!a || typeof a !== "object" || typeof a.id !== "string") return "has no id"
    return typeof a.verify === "function" ? null : "has no verify function"
  },
  gaps: (v) => (typeof v.says === "string" && v.says.trim() ? [] : ["does not say what it checks"]),
  document: (vs) => ["", "**Verifiers**, used by `naima verify`", ...table(["Verifier", "What it checks"], vs.map((v) => [code(v.id), v.says]))],
}
