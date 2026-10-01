// The mCRL2 model of the coordination protocol, checked without the toolset:
// balanced brackets, every action a formula names declared with that many
// arguments, every sort a formula quantifies over declared, both protocol
// rules on, and each properties item pointing at files that exist. Whether
// the properties hold is the toolset's to decide (naima verify).

import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..")
const DIR = "develop/models/coordination"
const MODEL = `${DIR}/claims.mcrl2`
const FORMULAS = [`${DIR}/no-claim-lost.mcf`, `${DIR}/released-claim-never-reappears.mcf`]
const PROPERTIES = join(ROOT, "naima-tracker/naima-data/properties")

/** The text without `%` comments. */
const code = (path: string): string => readFileSync(join(ROOT, path), "utf8").replace(/%[^\n]*/g, "")

/** The text of one section: from its keyword to the next section keyword. */
function section(text: string, keyword: string): string {
  const m = text.match(new RegExp(`(?:^|\\n)${keyword}\\s([\\s\\S]*?)(?=\\n(?:sort|map|var|eqn|act|proc|init)\\s|$)`))
  assert.ok(m, `the model has a ${keyword} section`)
  return m[1]!
}

/** Each declared action and its number of arguments. */
function actions(model: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const decl of section(model, "act").split(";")) {
    const [names, sorts] = decl.split(":")
    if (!names?.trim()) continue
    const arity = sorts ? sorts.split("#").length : 0
    for (const n of names.split(",")) out.set(n.trim(), arity)
  }
  return out
}

/** The arguments of a call starting at `open`, an index of `(`, split at top-level commas. */
function args(text: string, open: number): string[] {
  let depth = 0
  let start = open + 1
  const out: string[] = []
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === "(" || c === "{") depth++
    else if (c === ")" || c === "}") {
      depth--
      if (depth === 0) return [...out, text.slice(start, i)].filter((a) => a.trim())
    } else if (c === "," && depth === 1) {
      out.push(text.slice(start, i))
      start = i + 1
    }
  }
  throw new Error("unbalanced call")
}

function balanced(text: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" }
  const stack: string[] = []
  for (const c of text) {
    if ("([{".includes(c)) stack.push(c)
    else if (c in pairs && stack.pop() !== pairs[c]) return false
  }
  return stack.length === 0
}

test("the coordination model's brackets balance, and both protocol rules are on", () => {
  const model = code(MODEL)
  assert.ok(balanced(model))
  for (const rule of ["ff_only", "own_files_only"]) assert.match(section(model, "eqn"), new RegExp(`\\b${rule} = true;`), `${rule} is on`)
  assert.match(model, /\ninit\s+Repo\(/)
})

test("each formula names only actions the model declares, with their arity, and sorts it declares", () => {
  const model = code(MODEL)
  const acts = actions(model)
  const sorts = new Set([...section(model, "sort").matchAll(/(\w+)\s*=/g)].map((m) => m[1]!))
  for (const path of FORMULAS) {
    const f = code(path)
    assert.ok(balanced(f), `${path}: brackets balance`)
    let used = 0
    for (const m of f.matchAll(/\b([a-z_]\w*)\s*\(/g)) {
      const name = m[1]!
      if (["val", "exists", "forall", "mu", "nu"].includes(name)) continue
      assert.ok(acts.has(name), `${path}: ${name} is an action of the model`)
      assert.equal(args(f, m.index! + m[0].length - 1).length, acts.get(name), `${path}: ${name} takes ${acts.get(name)} arguments`)
      used++
    }
    assert.ok(used > 0, `${path} names an action`)
    for (const m of f.matchAll(/(?:forall|exists)\s+([^.]*)\./g)) {
      for (const s of m[1]!.matchAll(/:\s*(\w+)/g)) {
        assert.ok(sorts.has(s[1]!) || ["Bool", "Nat", "Pos", "Int", "FSet", "Set"].includes(s[1]!), `${path}: ${s[1]} is a sort`)
      }
    }
  }
})

test("the coordination properties name the mcrl2 verifier, the model and a formula that exist", () => {
  const items = readdirSync(PROPERTIES)
    .map((d) => JSON.parse(readFileSync(join(PROPERTIES, d, "meta.json"), "utf8")) as Record<string, unknown>)
    .filter((m) => m["model"] === MODEL)
  assert.deepEqual(items.map((m) => m["property"]).sort(), [...FORMULAS].sort())
  for (const m of items) {
    assert.equal(m["verifier"], "mcrl2")
    assert.ok(existsSync(join(ROOT, String(m["property"]))))
  }
  const config = JSON.parse(readFileSync(join(ROOT, "naima-tracker/naima-data/naima.json"), "utf8")) as { plugins: Record<string, unknown> }
  assert.ok("verifier-mcrl2" in config.plugins, "the mCRL2 adapter is opted in")
})
