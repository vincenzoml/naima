// Epics: an item type that groups items; its status follows them, and a gate on it stands for them.

import assert from "node:assert/strict"
import { test } from "node:test"
import { addLink, createItem, type Plugin, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import epics from "../../../naima/src/plugins/epics/index.ts"
import gates, { type GateDef } from "../../../naima/src/plugins/gates/index.ts"

const open = { category: "open" as const, says: "" }
const fixture = (): Plugin => ({
  name: "fixture",
  says: "work items and proofs",
  types: [
    { id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open, closed: { category: "done", says: "" } }, initialStatus: "open" },
    { id: "tests", dir: "TESTS", title: "", says: "", statuses: { open, passed: { category: "done", proves: true, says: "" } }, initialStatus: "open" },
  ],
  fields: [
    { name: "fixedOn", kind: "date", says: "" },
    { name: "runBy", kind: "string", says: "" },
    { name: "humanBecause", kind: "string", says: "" },
  ],
  relations: [
    { name: "verifies", inverse: "verified-by", says: "" },
    { name: "verified-by", inverse: "verifies", says: "" },
  ],
})

const project = () => tempProject([fixture(), gates({ gates: { beta: { title: "Public beta" } } }), epics()])

test("an epic's status follows its items: open while any is open, done when all are closed", async () => {
  const p = project()
  try {
    const { ctx } = p
    const epic = createItem(ctx, typeOrThrow(ctx, "epics"), "Beta polish")
    const a = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash")
    const b = createItem(ctx, typeOrThrow(ctx, "bugs"), "Hang")
    const status = () => ctx.repo.resolve(`epics/${epic.slug}`).meta.status
    assert.equal(status(), "open")
    assert.equal(await p.run("epic", "add", epic.slug, a.slug, b.slug), 0)
    assert.equal(status(), "open")
    setFields(ctx, ctx.repo.resolve(a.slug), [["status", "closed"]])
    assert.equal(status(), "open")
    setFields(ctx, ctx.repo.resolve(b.slug), [["status", "closed"]])
    assert.equal(status(), "done")
    setFields(ctx, ctx.repo.resolve(b.slug), [["status", "open"]])
    assert.equal(status(), "open")
    // Taking the open item out of the epic leaves only closed ones.
    assert.equal(await p.run("epic", "remove", epic.slug, b.slug), 0)
    assert.equal(status(), "done")
    // A link stored on the epic side counts the same.
    addLink(ctx, ctx.repo.resolve(`epics/${epic.slug}`), "has-part", ctx.repo.resolve(b.slug))
    assert.equal(status(), "open")
  } finally {
    p.cleanup()
  }
})

test("an epic's status cannot be set against its items", async () => {
  const p = project()
  try {
    const { ctx } = p
    const epic = createItem(ctx, typeOrThrow(ctx, "epics"), "Beta polish")
    const a = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash")
    await p.run("epic", "add", epic.slug, a.slug)
    assert.throws(() => setFields(ctx, ctx.repo.resolve(`epics/${epic.slug}`), [["status", "done"]]), /an epic's status follows its items/)
  } finally {
    p.cleanup()
  }
})

test("naima epic shows each epic with its progress, what blocks it and whose hands it waits on", async () => {
  const p = project()
  try {
    const { ctx } = p
    const epic = createItem(ctx, typeOrThrow(ctx, "epics"), "Beta polish", { gate: "beta" })
    const a = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { runBy: "agent" })
    const b = createItem(ctx, typeOrThrow(ctx, "bugs"), "Hang", { runBy: "human" })
    const c = createItem(ctx, typeOrThrow(ctx, "bugs"), "Typo")
    await p.run("epic", "add", epic.slug, a.slug, b.slug, c.slug)
    setFields(ctx, ctx.repo.resolve(c.slug), [["status", "closed"]])
    p.output.length = 0
    assert.equal(await p.run("epic"), 0)
    const out = p.output.join("\n")
    assert.match(out, /epics\/beta-polish {2}Beta polish {2}\[open\] {2}1 of 3 closed · gate beta/)
    assert.match(out, /waiting on: agent 1, human 1/)
    assert.match(out, /✗ bugs\/crash {2}Crash {2}\(agent\)/)
    assert.doesNotMatch(out, /bugs\/typo/)
    p.output.length = 0
    await p.run("epic", "--json")
    const [row] = JSON.parse(p.output.join("\n"))
    assert.deepEqual([row.epic, row.closed, row.total, row.open], ["epics/beta-polish", 1, 3, ["bugs/crash", "bugs/hang"]])
    await assert.rejects(p.run("epic", "add", epic.slug, epic.slug), /cannot be part of itself/)
    await assert.rejects(p.run("epic", "add", a.slug, b.slug), /is not an epic/)
  } finally {
    p.cleanup()
  }
})

test("a gate on an epic stands for the epic's items", async () => {
  const p = project()
  try {
    const { ctx } = p
    const epic = createItem(ctx, typeOrThrow(ctx, "epics"), "Beta polish", { gate: "beta" })
    const beta = ctx.registry.find<GateDef>("gates", "beta")!.value
    // An empty epic on a gate blocks it: nothing is planned yet.
    assert.deepEqual((await beta.evaluate(ctx)).blocking.map((i) => i.slug), [epic.slug])
    const a = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash")
    await p.run("epic", "add", epic.slug, a.slug)
    assert.deepEqual((await beta.evaluate(ctx)).blocking.map((i) => i.slug), [a.slug])
    setFields(ctx, ctx.repo.resolve(a.slug), [["fixedOn", "2026-01-14"]])
    const r = await beta.evaluate(ctx)
    assert.deepEqual([r.holds, r.owed.map((i) => i.slug)], [true, [a.slug]])
  } finally {
    p.cleanup()
  }
})

test("a part-of link to an item that is not an epic is a problem", async () => {
  const p = project()
  try {
    const { ctx } = p
    const a = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash")
    createItem(ctx, typeOrThrow(ctx, "bugs"), "Hang", { links: [{ rel: "part-of", id: a.meta.id }] })
    assert.match((await runChecks(ctx)).problems.map((f) => f.message).join("\n"), /bugs\/hang is part of bugs\/crash, which is not an epic/)
  } finally {
    p.cleanup()
  }
})
