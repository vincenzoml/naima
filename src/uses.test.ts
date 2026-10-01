// A plugin declares what it reads of another's vocabulary, and the project
// refuses to load when it is not there: replacing or switching off the
// plugin that declares it is an error named at load, never a silent no-op.

import assert from "node:assert/strict"
import { test } from "node:test"
import { firstPartyPlugins } from "./builtins.ts"
import { buildRegistry, type Plugin } from "./core/internal.ts"
import { corePlugin } from "./core/base.ts"

const without = (name: string): Plugin[] => firstPartyPlugins().filter((p) => p.name !== name)

test("the first-party plugins declare what they read of each other, and it resolves", () => {
  const r = buildRegistry([corePlugin, ...firstPartyPlugins()])
  const gates = r.plugins.find((p) => p.name === "gates")
  assert.deepEqual(gates?.uses, { fields: ["fixedOn", "runBy", "humanBecause"], relations: ["verifies", "verified-by"] })
  assert.deepEqual(r.plugins.find((p) => p.name === "beta-markers")?.uses, { fields: ["closedFrom"] })
  assert.deepEqual(r.plugins.find((p) => p.name === "docs")?.uses, { types: ["features"] })
})

test("switching off the plugin whose vocabulary another uses fails at load, naming what is missing and who uses it", () => {
  assert.throws(
    () => buildRegistry([corePlugin, ...without("trackers")]),
    /plugin "gates" uses field "fixedOn", which no loaded plugin declares — load the plugin that declares it, or switch "gates" off too/,
  )
})

test("a third-party plugin's uses are held the same way: a missing name, an ambiguous one, a point nobody declares", () => {
  const reads = (uses: Plugin["uses"]): Plugin => ({ name: "reader", says: "reads others' vocabulary", ...(uses ? { uses } : {}) })
  assert.doesNotThrow(() => buildRegistry([corePlugin, ...firstPartyPlugins(), reads({ fields: ["trackers/fixedOn", "priority"], types: ["bugs"] })]))
  assert.throws(
    () => buildRegistry([corePlugin, ...firstPartyPlugins(), reads({ fields: ["severity"] })]),
    /plugin "reader" uses field "severity", which no loaded plugin declares/,
  )
  assert.throws(
    () => buildRegistry([corePlugin, ...firstPartyPlugins(), reads({ widgets: ["x"] })]),
    /plugin "reader" uses widgets, which no loaded plugin declares as an extension point/,
  )
  const twin: Plugin = { name: "twin", says: "", checks: [{ name: "links", says: "x", run: () => [] }] }
  assert.throws(
    () => buildRegistry([corePlugin, twin, reads({ checks: ["links"] })]),
    /plugin "reader" uses check "links": check "links" is ambiguous: core\/links, twin\/links/,
  )
})
