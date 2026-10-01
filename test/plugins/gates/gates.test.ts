import assert from "node:assert/strict"
import { test } from "node:test"
import { type Context, createItem, type Plugin, runChecks, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import gates, { type GateDef } from "../../../naima/src/plugins/gates/index.ts"

const gate = (ctx: Context, name: string): GateDef => ctx.registry.find<GateDef>("gates", name)!.value

// A stand-in for whatever plugin declares the item types: plugins never import each other.
const open = { category: "open" as const, says: "" }
const fixture = (): Plugin => ({
  name: "fixture",
  says: "work items and proofs",
  types: [
    { id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open }, initialStatus: "open" },
    { id: "todos", dir: "TODOS", title: "", says: "", statuses: { open }, initialStatus: "open" },
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

const config = { gates: { v1: { title: "First release" }, strict: { title: "Strict", holdsOn: "proof" } } }

test("a code gate waits for code, a proof gate for everything", async () => {
  const p = tempProject([fixture(), gates(config)])
  try {
    const { ctx } = p
    const bug = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { gate: "v1" })
    createItem(ctx, typeOrThrow(ctx, "tests"), "No crash", { gate: "v1", links: [{ rel: "verifies", id: bug.meta.id }], runBy: "human" })
    createItem(ctx, typeOrThrow(ctx, "todos"), "Docs", { gate: "strict", fixedOn: "2026-01-01" })

    let v1 = await gate(ctx, "v1").evaluate(ctx)
    assert.deepEqual([v1.holds, v1.blocking.length, v1.owed.length], [false, 1, 1])
    assert.equal(await p.run("gates", "--check"), 1)

    const { setFields } = await import("../../../naima/src/core/api.ts")
    setFields(ctx, ctx.repo.resolve(bug.slug), [["fixedOn", "2026-01-14"]])
    ctx.reload()
    v1 = await gate(ctx, "v1").evaluate(ctx)
    assert.deepEqual([v1.holds, v1.owed.length], [true, 2])
    assert.equal((await gate(ctx, "strict").evaluate(ctx)).holds, false)
    assert.equal(await p.run("gates", "v1", "--check"), 0)

    p.output.length = 0
    await p.run("queue", "v1")
    assert.match(p.output.join("\n"), /v1: 2 open — agent 0, human 2/)
  } finally {
    p.cleanup()
  }
})

test("an unknown gate is refused, and a proof of a gated item must be gated", async () => {
  const p = tempProject([fixture(), gates(config)])
  try {
    const { ctx } = p
    const bug = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { gate: "v1" })
    createItem(ctx, typeOrThrow(ctx, "tests"), "No crash", { links: [{ rel: "verifies", id: bug.meta.id }] })
    createItem(ctx, typeOrThrow(ctx, "todos"), "Typo", { gate: "v9" })
    const problems = (await runChecks(ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /verifies bugs\/crash \(gate v1\) but has no gate/)
    assert.match(problems, /gate "v9" is not one of: v1, strict/)
  } finally {
    p.cleanup()
  }
})

test("gates are configured, never hard-coded", () => {
  assert.throws(() => gates({ gates: { x: {} } }), /needs a title/)
  assert.throws(() => gates({ gates: { x: { title: "X", holdsOn: "vibes" } } }), /holdsOn/)
  assert.equal(gates().contributes?.["gates"]?.length, 0)
})

test("gated-proof-is-gated says what it decides: an ungated proof of a gated item is a problem, whatever it ranks", async () => {
  const check = gates(config).checks?.find((c) => c.name === "gated-proof-is-gated")
  assert.equal(check?.says, "an open item that verifies an open gated item carries a gate itself")
  const p = tempProject([fixture(), gates(config)])
  try {
    const { ctx } = p
    const bug = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { gate: "v1" })
    createItem(ctx, typeOrThrow(ctx, "tests"), "No crash", { links: [{ rel: "verifies", id: bug.meta.id }] })
    assert.match((await runChecks(ctx)).problems.map((f) => f.message).join("\n"), /verifies bugs\/crash \(gate v1\) but has no gate/)
  } finally {
    p.cleanup()
  }
})

test("the gates option names the file it is configured in, in the shape it is written", () => {
  const option = gates().options?.find((o) => o.name === "gates")
  assert.match(option?.says ?? "", /`plugins\.gates\.options\.gates` in `naima-tracker\/naima-data\/naima\.json`/)
  assert.doesNotMatch(option?.says ?? "", /naima\/config\.json/)
})
