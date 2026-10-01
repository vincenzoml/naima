// The dependency rule, enforced: the core imports no plugin and names no
// plugin's vocabulary, and a plugin imports only the plugin API, core/api.ts
// (plus, in tests, the core's test helper) and its own files — never
// core/internal.ts, which holds what only the entry point and the loader use. Every way a module can
// reach another is looked for: static and side-effect imports, re-exports,
// dynamic import() and require().

import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { firstPartyPlugins } from "../naima/src/builtins.ts"
import { corePlugin } from "../naima/src/core/base.ts"

const TESTS = dirname(fileURLToPath(import.meta.url))
/** The runtime folder, and its src/. */
const ROOT = join(dirname(TESTS), "naima")
const SRC = join(ROOT, "src")

function* sources(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name)
    if (e.isDirectory()) yield* sources(path)
    else if (/\.(ts|mts|js|mjs)$/.test(e.name)) yield path
  }
}

/** A module reference found in a source: its specifier, or null when it is computed and cannot be checked. */
interface Reference {
  spec: string | null
  how: "import" | "dynamic import" | "require"
}

/** Every module reference in a source text, comments included: a rule that a comment can hide is no rule. */
function references(text: string): Reference[] {
  const out: Reference[] = []
  // import x from "a", import { x } from "a", import type …, export … from "a", and the side-effect import "a"
  for (const m of text.matchAll(/(?:^|[\n;])\s*(?:import|export)\b(?:[^'"`;()]*?\bfrom\s*)?\s*(["'])([^"']+)\1/g)) out.push({ spec: m[2] ?? "", how: "import" })
  for (const m of text.matchAll(/\bimport\s*\(\s*([^)]*)\)/g)) {
    const arg = (m[1] ?? "").trim()
    const quoted = arg.match(/^(["'])([^"']+)\1$/)?.[2]
    const template = arg.match(/^`([^`$]+)`$/)?.[1]
    out.push({ spec: quoted ?? template ?? null, how: "dynamic import" })
  }
  for (const m of text.matchAll(/\b(?:require|createRequire)\s*\(\s*([^)]*)\)/g)) {
    out.push({ spec: (m[1] ?? "").trim().match(/^(["'])([^"']+)\1$/)?.[2] ?? null, how: "require" })
  }
  return out
}

const rel = (p: string) => relative(ROOT, p).split("\\").join("/")
const inside = (dir: string, path: string) => path === dir || path.startsWith(dir + "/") || path.startsWith(dir + "\\")
const CORE = join(SRC, "core")
const PUBLIC = join(CORE, "api.ts")
const TEST_HELPER = join(TESTS, "core", "testing.ts")
/** The one computed import the rule allows: the core loading a third-party plugin named in naima.json. */
const PLUGIN_LOADER = join(CORE, "plugins.ts")
/** Every place a plugin can live: the first-party ones, and the program's plugins/ for a fork's own. */
const PLUGIN_DIRS = [join(SRC, "plugins"), join(ROOT, "plugins")]

test("the core imports nothing outside itself but node built-ins, and requires nothing", () => {
  let checked = 0
  for (const file of sources(CORE)) {
    for (const r of references(readFileSync(file, "utf8"))) {
      checked++
      assert.notEqual(r.how, "require", `${rel(file)} uses require — the core is ES modules only`)
      if (r.spec === null) {
        assert.equal(file, PLUGIN_LOADER, `${rel(file)} has a computed ${r.how}; only ${rel(PLUGIN_LOADER)} may load a module by a computed name`)
        continue
      }
      if (r.spec.startsWith("node:")) continue
      assert.ok(r.spec.startsWith("."), `${rel(file)} imports package "${r.spec}" — the core has no dependencies`)
      const target = resolve(dirname(file), r.spec)
      assert.ok(inside(CORE, target), `${rel(file)} imports ${rel(target)}, outside the core`)
    }
  }
  assert.ok(checked > 0, "no core imports were found — the scanner is blind")
})

test("a plugin, wherever it lives, imports only the core's public API and its own files", () => {
  let checked = 0
  for (const base of PLUGIN_DIRS) {
    for (const file of sources(base)) {
      const parts = relative(base, file).split(/[\\/]/)
      // plugins/<name>/… owns its directory; a single-file plugin plugins/<name>.ts owns only itself
      const own = parts.length > 1 ? join(base, parts[0] ?? "") : file
      for (const r of references(readFileSync(file, "utf8"))) {
        checked++
        assert.notEqual(r.how, "require", `${rel(file)} uses require — a plugin is an ES module`)
        assert.ok(r.spec !== null, `${rel(file)} has a computed ${r.how}; a plugin's imports must be checkable`)
        if (r.spec.startsWith("node:")) continue
        assert.ok(r.spec.startsWith("."), `${rel(file)} imports package "${r.spec}" — plugins have no dependencies`)
        const target = resolve(dirname(file), r.spec)
        if (inside(own, target)) continue
        const allowed = target === PUBLIC || (/\.test\.ts$/.test(file) && target === TEST_HELPER)
        assert.ok(allowed, `${rel(file)} imports ${rel(target)}; a plugin may import only core/api.ts`)
      }
    }
  }
  assert.ok(checked > 0, "no plugin imports were found — the scanner is blind")
})

/** The contract's own words: the kinds of contribution a plugin declares. A plugin named after one ("gates") does not own the word. */
const CONTRACT = ["types", "fields", "relations", "dirs", "checks", "commands", "views", "summary", "rank", "gates", "verifiers", "options"].flatMap((
  k,
) => [k, k.replace(/s$/, "")])

/** The names first-party plugins declare and the core does not: the vocabulary the core must not speak. */
function pluginVocabulary(): Set<string> {
  const core = new Set<string>([...CONTRACT, ...(corePlugin.fields ?? []).map((f) => f.name), ...(corePlugin.relations ?? []).map((r) => r.name)])
  const names = new Set<string>()
  for (const p of firstPartyPlugins()) {
    for (
      const n of [
        p.name,
        ...(p.types ?? []).flatMap((t) => [t.id, t.dir]),
        ...(p.fields ?? []).map((f) => f.name),
        ...(p.relations ?? []).map((r) => r.name),
      ]
    ) {
      if (!core.has(n)) names.add(n)
    }
  }
  return names
}

/** String literals in a source's code (comments aside: prose may explain a plugin) that are exactly one of `names`. */
function namesIn(text: string, names: Set<string>): string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
  return [...code.matchAll(/(["'`])([A-Za-z][\w-]*)\1/g)].map((m) => m[2] ?? "").filter((s) => names.has(s))
}

test("the core names no plugin's type, field, relation or plugin", () => {
  const vocabulary = pluginVocabulary()
  assert.ok(vocabulary.has("bugs") && vocabulary.has("fixedOn") && vocabulary.has("verifies"), "the vocabulary is read from the plugins")
  for (const file of sources(CORE)) {
    if (/\.test\.ts$/.test(file) || file === TEST_HELPER) continue
    const found = namesIn(readFileSync(file, "utf8"), vocabulary)
    assert.deepEqual(found, [], `${rel(file)} names plugin vocabulary: ${found.join(", ")} — the core must work with any plugin set`)
  }
})

test("the scanner sees every way a module can reach another", () => {
  const specs = (text: string) => references(text).map((r) => `${r.how} ${r.spec ?? "<computed>"}`)
  assert.deepEqual(specs('import "../plugins/x/index.ts"'), ["import ../plugins/x/index.ts"])
  assert.deepEqual(specs("import type { A } from './a.ts'\nexport { b } from \"./b.ts\""), ["import ./a.ts", "import ./b.ts"])
  assert.deepEqual(specs("const m = await import(`../plugins/${name}.ts`)"), ["dynamic import <computed>"])
  assert.deepEqual(specs("const m = await import(`./fixed.ts`)"), ["dynamic import ./fixed.ts"])
  assert.deepEqual(specs("const req = createRequire(import.meta.url)"), ["require <computed>"])
  assert.deepEqual(specs('const x = require("../plugins/z")'), ["require ../plugins/z"])
  assert.deepEqual(namesIn('const hint = "todos"; const t = `bugs` // not "tests"', new Set(["todos", "bugs", "tests"])), ["todos", "bugs"])
  assert.ok(references(readFileSync(join(SRC, "builtins.ts"), "utf8")).some((r) => r.spec?.startsWith("./plugins/")))
})

test("the plugin API holds what a plugin may use, and nothing that loads, migrates or runs the program", async () => {
  const api = await import("../naima/src/core/api.ts")
  const internal = await import("../naima/src/core/internal.ts")
  for (
    const name of ["runCli", "openProject", "migrate", "buildRegistry", "composePlugins", "parseConfig", "createContext", "apiFor", "MIGRATIONS", "RELAUNCH"]
  ) {
    assert.ok(name in internal, `${name} is the core's`)
    assert.ok(!(name in api), `${name} is not a plugin's to call: it stays out of core/api.ts`)
  }
  for (const name of ["createItem", "saveMeta", "fieldValue", "runChecks", "linked", "CONTRACT"]) assert.ok(name in api, `${name} is in the plugin API`)
  const { apiFor } = internal
  const injected = apiFor("mine", { rename: { fields: { "mine/size": "bytes" } } })
  assert.equal(injected.plugin, "mine")
  assert.equal(injected.name("fields", "size"), "bytes")
  assert.equal(injected.contract, api.CONTRACT)
  assert.ok(Object.isFrozen(injected), "a plugin cannot change what another plugin is handed")
  assert.ok(!("runCli" in injected) && typeof injected.createItem === "function", "the same surface as core/api.ts")
})
