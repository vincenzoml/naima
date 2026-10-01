// Extending another plugin's types and fields as data, with no inheritance:
// a type carries plain traits and a field applies to a trait; an additive
// extension adds statuses, traits, transitions and enum values; status flags
// are open-ended. A third-party-style plugin does all of it against the
// first-party plugins, with nothing in the core edited.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { firstParty, firstPartyPlugins } from "./builtins.ts"
import { buildRegistry, FORMAT, hasFlag, type Plugin, runCli, saveMeta } from "./core/internal.ts"
import { corePlugin } from "./core/base.ts"
import { gitIn, removeTemp, tempProject } from "./core/testing.ts"

/** A third-party plugin: a new type tagged fixable, a new status on trackers' bugs, a new value of trackers' runBy, a flag of its own. */
const ops: Plugin = {
  name: "ops",
  says: "incidents, and what operations adds to the trackers",
  types: [{
    id: "incidents",
    dir: "incidents",
    title: "Incidents",
    says: "an outage",
    traits: ["fixable"],
    statuses: {
      open: { category: "open", says: "happening" },
      mitigated: { category: "open", flags: ["contained"], says: "contained, not fixed" },
      resolved: { category: "done", says: "over" },
    },
    initialStatus: "open",
    transitions: { resolved: [] },
  }],
  extends: [
    { type: "bugs", statuses: { blocked: { category: "open", flags: ["waiting"], says: "waiting on another team" } }, transitions: { wontfix: ["open"] } },
    { field: "runBy", values: { pager: "settled by whoever holds the pager" }, appliesTo: ["incidents"] },
  ],
}

test("a plugin adds a type, a status to another plugin's type, a value and a type to another's field, and gets a field by trait — without editing the core", async () => {
  const p = tempProject([...firstPartyPlugins(), ops])
  try {
    const r = p.ctx.registry
    assert.ok(r.fields.get("fixedOn")?.appliesTo?.includes("incidents"), "fixedOn applies to every type tagged fixable")
    assert.ok(r.fields.get("fixedOn")?.appliesTo?.includes("features"), "features are fixable too")
    assert.equal(r.types.get("bugs")?.statuses["blocked"]?.category, "open")
    assert.equal(r.types.get("bugs")?.statuses["open"]?.says, "nothing on the page has been done", "the owner's statuses stay as they were")
    assert.ok(Object.hasOwn(r.fields.get("runBy")?.values ?? {}, "pager"))

    assert.equal(await p.run("new", "incidents", "Database down", "--set", "fixedOn=2026-01-15", "--set", "runBy=pager"), 0, p.errors.join("\n"))
    assert.equal(await p.run("new", "bugs", "Export drops alpha"), 0)
    assert.equal(await p.run("set", "export-drops-alpha", "status=blocked"), 0)
    const bug = p.ctx.repo.resolve("export-drops-alpha")
    assert.ok(hasFlag(p.ctx, bug, "waiting"), "an open-ended flag, read by whoever gives it meaning")
    assert.ok(!hasFlag(p.ctx, bug, "proves"))
    assert.equal(await p.run("set", "database-down", "status=mitigated"), 0)
    assert.ok(hasFlag(p.ctx, p.ctx.repo.resolve("database-down"), "contained"))
    assert.equal(await p.run("check"), 0, p.output.join("\n"))
  } finally {
    p.cleanup()
  }
})

test("an extension may add, never redefine: an existing status keeps its category, and a field its kind", () => {
  const plugins = firstPartyPlugins()
  const flip: Plugin = { name: "flip", says: "", extends: [{ type: "bugs", statuses: { open: { category: "done", says: "closed, really" } } }] }
  assert.throws(() => buildRegistry([corePlugin, ...plugins, flip]), /"flip" extends type "bugs": status "open" is open, and an extension may not make it done/)
  const same: Plugin = { name: "same", says: "", extends: [{ type: "bugs", statuses: { partial: { category: "open", flags: ["half"], says: "half done" } } }] }
  const r = buildRegistry([corePlugin, ...plugins, same])
  assert.equal(r.types.get("bugs")?.statuses["partial"]?.says, "half done", "redefined within its category")
  assert.deepEqual(r.types.get("bugs")?.statuses["partial"]?.flags, ["half"])
  const both: Plugin = { name: "both", says: "", extends: [{ type: "tests", statuses: { passed: { category: "done", refutes: true, says: "" } } }] }
  assert.throws(() => buildRegistry([corePlugin, ...plugins, both]), /status "passed" both proves and refutes/, "a flag added may not contradict one there")
  const kind: Plugin = { name: "kind", says: "", extends: [{ field: "fixedOn", values: { soon: "later" } }] }
  assert.throws(() => buildRegistry([corePlugin, ...plugins, kind]), /extends field "fixedOn" with values, and it is a date, not an enum/)
  const stray: Plugin = { name: "stray", says: "", extends: [{ type: "bugs", values: {} }] }
  assert.throws(() => buildRegistry([corePlugin, ...plugins, stray]), /extends a type, which takes no "values"/)
  assert.throws(
    () => buildRegistry([corePlugin, ...plugins, { name: "nobody", says: "", extends: [{ type: "widgets" }] }]),
    /extends type "widgets", which no plugin declares/,
  )
})

test("a type's transitions hold on every write: a status moves only where they allow, and a forced write takes the move on", async () => {
  const p = tempProject([...firstPartyPlugins(), ops])
  try {
    assert.equal(await p.run("new", "incidents", "Disk full", "--set", "status=resolved"), 0)
    await assert.rejects(p.run("set", "disk-full", "status=open"), /from resolved its status moves to nothing, not open/)
    assert.equal(await p.run("new", "bugs", "Crash"), 0)
    assert.equal(await p.run("set", "crash", "status=wontfix"), 0, "the owner's type allowed any move before, and still does from open")
    assert.equal(await p.run("set", "crash", "status=open"), 0, "the extension allows wontfix → open")
    await p.run("set", "crash", "status=wontfix")
    await assert.rejects(p.run("set", "crash", "status=partial"), /from wontfix its status moves to open, not partial/)
    const crash = p.ctx.repo.resolve("crash")
    crash.meta.status = "partial"
    saveMeta(p.ctx, crash, { force: true })
    assert.equal(p.ctx.repo.resolve("crash").meta.status, "partial")
  } finally {
    p.cleanup()
  }
})

test("the gate field takes its values from every gate contributed, and an item may be on several", async () => {
  const gates = { v1: { title: "First" }, v2: { title: "Second" } }
  const p = tempProject([...firstPartyPlugins({ gates: { gates } })])
  try {
    assert.deepEqual(Object.keys(p.ctx.registry.fields.get("gate")?.values ?? {}), ["v1", "v2", "properties"], "the project's and the verifier plugin's")
    assert.equal(await p.run("new", "bugs", "Crash", "--set", "gate=v1,v2"), 0)
    assert.deepEqual(p.ctx.repo.resolve("crash").meta["gate"], ["v1", "v2"])
    assert.equal(await p.run("gates", "v1", "v2"), 0)
    assert.match(p.output.join("\n"), /v1 — First: BLOCKED by 1[\s\S]*v2 — Second: BLOCKED by 1/)
    await assert.rejects(p.run("set", "crash", "gate=v3"), /gate: "v3" is not one of: v1, v2, properties, or a list of them/)
    assert.equal(await p.run("set", "crash", "gate=v2"), 0)
    assert.equal(p.ctx.repo.resolve("crash").meta["gate"], "v2", "one gate stays a string, as format 1 stored it")
  } finally {
    p.cleanup()
  }
})

test("a project extends the loaded plugins from naima.json, as a plugin would", async () => {
  const base = mkdtempSync(join(tmpdir(), "naima-extends-"))
  const root = join(base, "project")
  const data = join(root, "naima-tracker", "naima-data")
  mkdirSync(data, { recursive: true })
  gitIn(root, "init", "-q", "-b", "main")
  writeFileSync(
    join(data, "naima.json"),
    JSON.stringify({
      format: FORMAT,
      formats: { gates: 2 },
      source: "https://example.invalid/naima.git",
      commit: "0".repeat(40),
      extends: [{ type: "features", statuses: { parked: { category: "open", says: "agreed, not scheduled" } } }],
    }),
  )
  const out: string[] = []
  const io = { out: (l = "") => void out.push(l), err: (l: string) => void out.push(l), now: () => new Date("2026-01-15T10:00:00Z") }
  const run = (...argv: string[]) => runCli(argv, { cwd: root, programRoot: base, firstParty, io })
  try {
    assert.equal(await run("new", "features", "Dark mode", "--set", "status=parked"), 0, out.join("\n"))
    assert.equal(await run("plugins"), 0)
    assert.match(out.join("\n"), /^project — the project's own extensions/m)
  } finally {
    removeTemp(base)
  }
})
