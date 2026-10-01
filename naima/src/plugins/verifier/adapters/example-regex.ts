// A trivial adapter that shows the shape of a real one. The "model" is any
// text file and the property is one of:
//
//   some <regex>    holds when at least one line matches
//   never <regex>   holds when no line matches; the first match is the counterexample
//
// A real adapter (mCRL2, VoxLogicA) runs the tool, maps its exit status and
// output to a verdict, and returns the trace it printed.

import { readFileSync } from "node:fs"
import { message } from "../../../core/api.ts"
import type { Verifier, VerifyRequest, VerifyResult } from "../contract.ts"

/** The whole check, synchronous: a real adapter awaits its tool here. */
function check({ model, property }: VerifyRequest): VerifyResult {
  const m = property.match(/^(some|never)\s+(.+)$/)
  if (!m?.[1] || !m[2]) return { verdict: "error", output: `property must be "some <regex>" or "never <regex>", got: ${property}` }
  let re: RegExp
  try {
    re = new RegExp(m[2])
  } catch (e) {
    return { verdict: "error", output: `bad regex: ${message(e)}` }
  }
  // One trailing newline ends the last line; it does not start another. CRLF files match as LF ones.
  const lines = readFileSync(model, "utf8").replace(/\r?\n$/, "").split(/\r?\n/)
  const hit = lines.findIndex((l) => re.test(l))
  if (m[1] === "some") {
    return hit === -1
      ? { verdict: "violated", output: "no line matches", counterexample: `no line of the model matches /${m[2]}/` }
      : { verdict: "holds", output: `line ${hit + 1} matches` }
  }
  return hit === -1
    ? { verdict: "holds", output: `none of ${lines.length} lines matches` }
    : { verdict: "violated", output: `line ${hit + 1} matches`, counterexample: `${hit + 1}: ${lines[hit]}` }
}

export const exampleRegex: Verifier = {
  id: "example-regex",
  says: 'line-regex properties over a text file: "some <re>" or "never <re>"',
  verify: (request) => Promise.resolve(check(request)),
}
