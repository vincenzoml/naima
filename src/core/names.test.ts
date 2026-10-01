// Qualified ids, short aliases and the rename map: two plugins that declare
// the same name coexist, by qualified id where the name only runs, by a
// project's rename where it is stored in the data.

import assert from "node:assert/strict"
import { test } from "node:test"
import { buildRegistry, createItem, type Plugin, type PluginScope, runChecks, setFields } from "./internal.ts"
import { corePlugin } from "./base.ts"
import { tempProject } from "./testing.ts"

const incidents = (scope?: PluginScope): Plugin => {
  const name = (kind: string, n: string) => scope?.name(kind, n) ?? n
  return {
    name: scope?.plugin ?? "ops",
    says: "incidents",
    types: [{
      id: "incidents",
      dir: "incidents",
      title: "Incidents",
      says: "outages",
      statuses: { open: { category: "open", says: "open" } },
      initialStatus: "open",
    }],
    fields: [{ name: "priority", kind: "enum", says: "how bad", values: { p1: "down", p2: "degraded" }, appliesTo: ["incidents"] }],
    relations: [{ name: "caused", inverse: "caused-by", says: "caused" }, { name: "caused-by", inverse: "caused", says: "was caused by" }],
    commands: [{ name: "list", says: "list incidents", usage: "list", run: (_a, ctx) => (ctx.out(`ops list, priority as ${name("fields", "priority")}`), 0) }],
  }
}

const triage: Plugin = { name: "triage", says: "t", fields: [{ name: "priority", kind: "enum", says: "when", values: { now: "now", later: "later" } }] }

test("every contribution has a qualified id; a short name resolves while it is unambiguous", () => {
  const r = buildRegistry([corePlugin, incidents()])
  assert.equal(r.find("types", "incidents")?.id, "ops/incidents")
  assert.equal(r.find("fields", "ops/priority")?.name, "priority")
  assert.equal(r.find("commands", "show")?.id, "core/show")
  assert.equal(r.find("fields", "nothing"), undefined)
})

test("a name two plugins would both store is refused at load, naming both qualified ids and the rename that resolves it", () => {
  assert.throws(
    () => buildRegistry([corePlugin, triage, incidents()]),
    /field "priority" is declared by both "triage" \(triage\/priority\) and "ops" \(ops\/priority\), and both would be stored as "priority" — rename one in naima\.json: "rename": \{ "fields": \{ "ops\/priority": "<another name>" \} \}/,
  )
})

test("a rename resolves a stored collision: the contribution goes by its new name, its own plugin reads it so, and its data is stored so", async () => {
  const rename = { fields: { "ops/priority": "severity" }, relations: { "ops/caused": "led-to" } }
  const scope: PluginScope = { plugin: "ops", name: (kind, n) => (rename as Record<string, Record<string, string>>)[kind]?.[`ops/${n}`] ?? n }
  const p = tempProject([triage, incidents(scope)], { rename, fixedNames: ["core", "triage"] })
  try {
    const r = p.ctx.registry
    assert.equal(r.fields.get("severity")?.name, "severity")
    assert.deepEqual(r.fields.get("severity")?.appliesTo, ["incidents"])
    assert.equal(r.fields.get("priority")?.says, "when", "triage's keeps its name")
    assert.equal(r.find("fields", "ops/priority")?.name, "severity", "the qualified id is the declared one")
    assert.equal(r.relations.get("caused-by")?.inverse, "led-to", "an inverse follows its relation's rename")
    const item = createItem(p.ctx, r.types.get("incidents")!, "Database down")
    setFields(p.ctx, item, [["severity", "p1"], ["priority", "now"]])
    assert.deepEqual([item.meta["severity"], item.meta["priority"]], ["p1", "now"])
    assert.equal((await runChecks(p.ctx)).problems.length, 0)
  } finally {
    p.cleanup()
  }
})

test("a rename must name a contribution a loaded plugin declares, and never a plugin that reads its names as declared", () => {
  assert.throws(
    () => buildRegistry([corePlugin, incidents()], { rename: { fields: { "ops/nothing": "x" } } }),
    /"ops\/nothing" is no field a loaded plugin declares/,
  )
  assert.throws(() => buildRegistry([corePlugin, incidents()], { rename: { widgets: {} } }), /rename\.widgets: not an extension point/)
  assert.throws(
    () => buildRegistry([corePlugin, triage, incidents()], { rename: { fields: { "triage/priority": "when" } }, fixedNames: ["core", "triage"] }),
    /"triage\/priority" is triage's, which reads its own names as declared — rename the other plugin's instead/,
  )
  assert.throws(() => buildRegistry([corePlugin, incidents()], { rename: { fields: { "ops/priority": "a/b" } } }), /is not a name/)
})

test("commands two plugins share run by qualified id; the short name is refused as ambiguous, naming both", async () => {
  const p = tempProject([incidents()])
  try {
    const r = p.ctx.registry
    assert.ok(r.commands.has("core/list") && r.commands.has("ops/list"), "keyed by the name each is invoked by")
    assert.ok(r.commands.has("show"))
    await p.run("ops/list")
    assert.equal(p.output.at(-1), "ops list, priority as priority")
    await assert.rejects(p.run("list"), /command "list" is ambiguous: core\/list, ops\/list — name one by its qualified id/)
  } finally {
    p.cleanup()
  }
})
