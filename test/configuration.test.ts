// The plugins table of naima.json, end to end through the entry point: a
// first-party plugin's options reach it, a plugin can be switched off or
// replaced, a check can be weighed differently, and format-1 data — a list of
// plugins, a top-level gates key — is migrated.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { firstParty } from "../naima/src/builtins.ts"
import { FORMAT, runCli } from "../naima/src/core/internal.ts"
import { pluginsTable } from "../naima/src/core/migrations.ts"
import { gitIn, removeTemp } from "./core/testing.ts"
import { moveGates } from "../naima/src/plugins/gates/index.ts"

const LOCK = { source: "https://example.invalid/naima.git", commit: "0".repeat(40) }

/** A git repository holding a Naima project whose naima.json is `config`, and a program directory for its plugins. */
function project(config: Record<string, unknown> = {}) {
  const base = mkdtempSync(join(tmpdir(), "naima-config-"))
  const root = join(base, "project")
  const data = join(root, "naima-tracker", "naima-data")
  const program = join(base, "program")
  mkdirSync(data, { recursive: true })
  mkdirSync(join(program, "plugins"), { recursive: true })
  gitIn(root, "init", "-q", "-b", "main")
  const file = join(data, "naima.json")
  const write = (c: Record<string, unknown>) => writeFileSync(file, JSON.stringify({ format: FORMAT, formats: { gates: 2 }, ...LOCK, ...c }, null, 2))
  write(config)
  const run = async (...argv: string[]) => {
    const out: string[] = []
    const err: string[] = []
    const io = { out: (l = "") => void out.push(l), err: (l: string) => void err.push(l), now: () => new Date("2026-01-15T10:00:00Z") }
    const code = await runCli(argv, { cwd: root, data: join(root, "naima-tracker", "naima-data"), programRoot: program, firstParty, io })
    return { code, out: out.join("\n"), err: err.join("\n") }
  }
  return { root, data, program, write, run, raw: () => JSON.parse(readFileSync(file, "utf8")), cleanup: () => removeTemp(base) }
}

test("a first-party plugin takes its options from the plugins table: the docs reference is held, beta markers scan where they are told", async () => {
  const p = project({ plugins: { docs: { options: { reference: "docs/reference.md" } } } })
  try {
    const missing = await p.run("check")
    assert.equal(missing.code, 1)
    assert.match(missing.out, /docs\/reference\.md does not exist — naima docs --write docs\/reference\.md/, "reference-current is reachable")
    assert.equal((await p.run("docs", "--write")).code, 0)
    assert.equal((await p.run("check")).code, 0, "held current once written")

    mkdirSync(join(p.root, "lib"))
    mkdirSync(join(p.root, "app"))
    writeFileSync(join(p.root, "lib", "a.ts"), "// naima:beta tests/nothing-here  unproven\n")
    writeFileSync(join(p.root, "app", "b.ts"), "// naima:beta tests/nothing-either  unproven\n")
    p.write({ plugins: { "beta-markers": { options: { paths: ["lib"] } } } })
    const beta = await p.run("beta")
    assert.match(beta.out, /lib\/a\.ts:1/)
    assert.doesNotMatch(beta.out, /app\/b\.ts/, "only the configured path is scanned")
  } finally {
    p.cleanup()
  }
})

test("a plugin switched off is not loaded; a replaced one runs other code under its name; the core can only be weighed", async () => {
  const p = project({ plugins: { "beta-markers": { enabled: false } } })
  try {
    assert.match((await p.run("beta")).err, /unknown command "beta"/)
    assert.doesNotMatch((await p.run("plugins")).out, /beta-markers/)

    writeFileSync(
      join(p.program, "plugins", "quiet-triage.mjs"),
      `export default (o) => ({ name: "anything", says: "triage, replaced", commands: [{ name: "triage", says: "x", usage: "triage", examples: ["triage"], run: (_a, ctx) => { ctx.out("replaced " + o.tone); return 0 } }] })\n`,
    )
    p.write({ plugins: { triage: { replacedBy: "plugins/quiet-triage.mjs", options: { tone: "softly" } } } })
    assert.equal((await p.run("triage")).out, "replaced softly")
    assert.match((await p.run("plugins")).out, /^triage — triage, replaced$/m, "registered under the name the project gives it")

    p.write({ plugins: { core: { enabled: false } } })
    assert.match((await p.run("check")).err, /plugins\.core is the core: it is always loaded as it is, and only its checks can be weighed/)
  } finally {
    p.cleanup()
  }
})

test("a check is weighed as the project says: a note made a problem, a problem a note, a check switched off; a check nobody declares is refused", async () => {
  const p = project()
  try {
    for (const title of ["Export drops alpha", "Export drops alpha"]) assert.equal((await p.run("new", "bugs", title)).code, 0)
    writeFileSync(join(p.root, "README.md"), "[gone](missing.md)\n")
    const base = await p.run("check")
    assert.equal(base.code, 1)
    assert.match(base.out, /✗ README\.md:1: link missing\.md/)
    assert.match(base.out, /· possible duplicates, not linked/)

    p.write({ plugins: { core: { checks: { duplicates: "problem" } }, docs: { checks: { "links-resolve": "note" } } } })
    const weighed = await p.run("check")
    assert.match(weighed.out, /✗ possible duplicates, not linked/)
    assert.match(weighed.out, /· README\.md:1: link missing\.md/)

    p.write({ plugins: { core: { checks: { duplicates: "off" } }, docs: { checks: { "links-resolve": "off" } } } })
    const off = await p.run("check")
    assert.equal(off.code, 0, off.out)
    assert.doesNotMatch(off.out, /duplicates|missing\.md/)

    p.write({ plugins: { docs: { checks: { "no-such-check": "off" } } } })
    assert.match(
      (await p.run("check")).err,
      /plugins\.docs\.checks names "no-such-check", which docs does not declare — its checks: documented, reference-current/,
    )
  } finally {
    p.cleanup()
  }
})

test("format 1 moves forward: the plugins list becomes the table, the top-level gates the gates plugin's options", () => {
  const legacy = {
    format: 1,
    ...LOCK,
    plugins: ["plugins/mine.ts", { name: "plugins/other/index.ts", options: { strict: true } }, "lib/mine.mjs"],
    gates: { v1: { title: "One" } },
  }
  const core = pluginsTable.config?.(legacy) ?? {}
  assert.deepEqual(core["plugins"], {
    mine: { source: "plugins/mine.ts" },
    other: { source: "plugins/other/index.ts", options: { strict: true } },
    "mine-2": { source: "lib/mine.mjs" },
  })
  const moved = moveGates.config?.(core) ?? {}
  assert.equal(moved["gates"], undefined)
  assert.deepEqual((moved["plugins"] as Record<string, unknown>)["gates"], { options: { gates: { v1: { title: "One" } } } })
  assert.deepEqual(pluginsTable.config?.(moved), moved, "a table is left as it is")
  assert.deepEqual(moveGates.config?.(moved), moved, "and gates already moved stay where they are")
  assert.deepEqual(moveGates.config?.({ ...LOCK, gates: {} }), { ...LOCK }, "no gates: the empty key goes")
})

test("the development build reads format-1 data as migrated, in memory: its gates hold, and it says what update will do", async () => {
  const p = project()
  try {
    writeFileSync(join(p.data, "naima.json"), JSON.stringify({ format: 1, ...LOCK, gates: { v1: { title: "One" } } }))
    const before = readFileSync(join(p.data, "naima.json"), "utf8")
    const gates = await p.run("gates")
    assert.equal(gates.code, 0, gates.err)
    assert.match(gates.out, /^v1 — One: HOLDS$/m)
    assert.match(
      gates.err,
      /the data owes format 1 \(plugins becomes a table.*\), gates format 1 \(the top-level gates key .*\) — read as migrated, in memory; naima update migrates it/,
    )
    assert.equal(readFileSync(join(p.data, "naima.json"), "utf8"), before, "nothing written")
  } finally {
    p.cleanup()
  }
})

test("naima plugin show lists every plugin: core always loaded, a first-party one on, an opt-in one off until named", async () => {
  const p = project()
  try {
    const show = await p.run("plugin", "show")
    assert.equal(show.code, 0, show.err)
    assert.match(show.out, /^core\s+always loaded$/m)
    assert.match(show.out, /^trackers\s+on$/m)
    assert.match(show.out, /^verifier-mcrl2\s+off \(opt-in\)$/m)
    assert.equal(p.raw()["plugins"], undefined, "only reads")
  } finally {
    p.cleanup()
  }
})

test("naima plugin enable turns on an opt-in plugin, set writes a validated option and an empty value removes it, disable turns it off keeping its options", async () => {
  const p = project()
  try {
    const enable = await p.run("plugin", "enable", "verifier-mcrl2")
    assert.equal(enable.code, 0, enable.err)
    assert.deepEqual(p.raw()["plugins"], { "verifier-mcrl2": {} }, "present, even empty: that alone loads an opt-in plugin")

    const shown = await p.run("plugin", "show", "verifier-mcrl2")
    assert.equal(shown.code, 0, shown.err)
    assert.match(shown.out, /^verifier-mcrl2: on$/m)
    assert.match(shown.out, /bin \(default PATH\) — the absolute directory holding the mCRL2 tools/)

    const bad = await p.run("plugin", "set", "verifier-mcrl2", "nope=1")
    assert.equal(bad.code, 2)
    assert.match(bad.err, /plugins\.verifier-mcrl2 declares no option "nope" — its options: bin/)
    assert.deepEqual((p.raw()["plugins"] as Record<string, unknown>)["verifier-mcrl2"], {}, "nothing written on refusal")

    const set = await p.run("plugin", "set", "verifier-mcrl2", "bin=/opt/mcrl2")
    assert.equal(set.code, 0, set.err)
    assert.deepEqual(p.raw()["plugins"], { "verifier-mcrl2": { options: { bin: "/opt/mcrl2" } } })

    const unset = await p.run("plugin", "set", "verifier-mcrl2", "bin=")
    assert.equal(unset.code, 0, unset.err)
    assert.deepEqual(p.raw()["plugins"], { "verifier-mcrl2": {} }, "empty value removes it, but the plugin stays enabled")

    const disable = await p.run("plugin", "disable", "verifier-mcrl2")
    assert.equal(disable.code, 0, disable.err)
    assert.deepEqual(p.raw()["plugins"], { "verifier-mcrl2": { enabled: false } })
    assert.match((await p.run("plugin", "show", "verifier-mcrl2")).out, /^verifier-mcrl2: off$/m)
  } finally {
    p.cleanup()
  }
})

test("naima plugin enable on a plugin the table only disabled prunes the entry back to the default; disable and set refuse the core and an unknown name", async () => {
  const p = project({ plugins: { "beta-markers": { enabled: false } } })
  try {
    const enable = await p.run("plugin", "enable", "beta-markers")
    assert.equal(enable.code, 0, enable.err)
    assert.equal(p.raw()["plugins"], undefined, "nothing left to say: a non-opt-in plugin the table does not name is loaded as it is")

    for (const argv of [["plugin", "enable", "core"], ["plugin", "disable", "core"], ["plugin", "set", "core", "x=1"]]) {
      const r = await p.run(...argv)
      assert.equal(r.code, 2, argv.join(" "))
      assert.match(r.err, /core is always loaded|core takes no options/)
    }

    const unknown = await p.run("plugin", "enable", "nope")
    assert.equal(unknown.code, 2)
    assert.match(unknown.err, /no plugin named "nope" — first-party: trackers,/)
  } finally {
    p.cleanup()
  }
})
