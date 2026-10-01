// Milestones (a gate with a date and a version) and gates declared by command.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, type Plugin, runChecks, typeOrThrow } from "../../../naima/src/core/api.ts"
import { corePlugin } from "../../../naima/src/core/base.ts"
import { buildRegistry } from "../../../naima/src/core/internal.ts"
import { createContext, tempProject } from "../../core/testing.ts"
import gates from "../../../naima/src/plugins/gates/index.ts"

const open = { category: "open" as const, says: "" }
const fixture = (): Plugin => ({
  name: "fixture",
  says: "work items and proofs",
  types: [
    { id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open, done: { category: "done", says: "" } }, initialStatus: "open" },
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

// The fixed clock of tempProject is 2026-01-15.
const milestones = {
  gates: {
    beta: { title: "Public beta", due: "2026-02-01", version: "0.9" },
    late: { title: "Late one", due: "2026-01-10" },
    today: { title: "Due today", due: "2026-01-15" },
  },
}

test("a gate with a date is a milestone: gates and queue show the days left or overdue", async () => {
  const p = tempProject([fixture(), gates(milestones)])
  try {
    const { ctx } = p
    createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { gate: ["beta", "late"] })
    await p.run("gates")
    const out = p.output.join("\n")
    assert.match(out, /beta — Public beta \(version 0\.9; due 2026-02-01, 17 days left\): BLOCKED by 1/)
    assert.match(out, /late — Late one \(due 2026-01-10, 5 days overdue\): BLOCKED by 1/)
    assert.match(out, /today — Due today \(due 2026-01-15, today\): HOLDS/)
    p.output.length = 0
    await p.run("queue", "late")
    assert.match(p.output.join("\n"), /late \(due 2026-01-10, 5 days overdue\): 1 open/)
  } finally {
    p.cleanup()
  }
})

test("a check warns when a milestone is past its date and does not hold, never when it holds", async () => {
  const p = tempProject([fixture(), gates(milestones)])
  try {
    const { ctx } = p
    assert.equal((await runChecks(ctx)).notes.filter((f) => /overdue/.test(f.message)).length, 0)
    createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { gate: "late" })
    const report = await runChecks(ctx)
    assert.match(report.notes.map((f) => f.message).join("\n"), /milestone late \(Late one\) was due on 2026-01-10, 5 days ago, and is blocked by 1/)
    assert.equal(report.problems.filter((f) => /overdue|was due/.test(f.message)).length, 0)
  } finally {
    p.cleanup()
  }
})

test("due and version are validated where the gate is declared", () => {
  assert.throws(() => gates({ gates: { x: { title: "X", due: "next week" } } }), /due is a date, YYYY-MM-DD/)
  assert.throws(() => gates({ gates: { x: { title: "X", due: "2026-02-30" } } }), /due is a date, YYYY-MM-DD/)
  assert.throws(() => gates({ gates: { x: { title: "X", version: "" } } }), /version/)
})

const dataFile = (root: string) => join(root, "naima-tracker", "naima-data", "naima.json")
const readGates = (root: string) => JSON.parse(readFileSync(dataFile(root), "utf8")).plugins?.gates?.options?.gates

test("gate new declares a gate in naima.json, validated; the next run has it", async () => {
  const p = tempProject([fixture(), gates({})])
  try {
    assert.equal(await p.run("gate", "new", "beta", "Public beta", "--says", "the first outside users", "--due", "2026-03-01", "--version", "0.9"), 0)
    assert.deepEqual(readGates(p.root), { beta: { title: "Public beta", says: "the first outside users", due: "2026-03-01", version: "0.9" } })
    assert.match(p.output.join("\n"), /gate beta declared/)
    await assert.rejects(p.run("gate", "new", "beta", "Again"), /a gate "beta" already exists/)
    await assert.rejects(p.run("gate", "new", "rc", "RC", "--due", "soon"), /due is a date, YYYY-MM-DD/)
    await assert.rejects(p.run("gate", "new", "rc", "RC", "--holds-on", "vibes"), /holdsOn is "code" or "proof"/)
    await assert.rejects(p.run("gate", "new", "Bad Name", "X"), /a gate's name is lowercase/)
    await assert.rejects(p.run("gate", "new", "rc"), /usage: naima gate/)
    assert.deepEqual(Object.keys(readGates(p.root)), ["beta"])

    // What the next run loads: the plugin made from the options now on disk.
    const options = JSON.parse(readFileSync(dataFile(p.root), "utf8")).plugins.gates.options
    const ctx = createContext(
      { root: p.root, data: p.ctx.trackerRoot, program: p.ctx.program },
      p.ctx.config,
      buildRegistry([corePlugin, fixture(), gates(options)]),
      {
        out: () => {},
        err: () => {},
        now: () => p.ctx.now(),
      },
    )
    assert.equal(ctx.registry.find("gates", "beta")?.name, "beta")
  } finally {
    p.cleanup()
  }
})

test("gate add and remove put items on a gate and take them off, through the write hooks; gate show lists it", async () => {
  const seen: string[] = []
  const spy: Plugin = { name: "spy", says: "records writes", hooks: [{ name: "spy", says: "records writes", afterWrite: (w) => void seen.push(w.item.slug) }] }
  const p = tempProject([fixture(), gates({ gates: { beta: { title: "Public beta", due: "2026-02-01" }, v1: { title: "One" } } }), spy])
  try {
    const { ctx } = p
    const bug = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { gate: "v1" })
    const other = createItem(ctx, typeOrThrow(ctx, "bugs"), "Hang")
    seen.length = 0
    assert.equal(await p.run("gate", "add", "beta", bug.slug, other.slug), 0)
    assert.deepEqual(seen, [bug.slug, other.slug])
    assert.deepEqual(ctx.repo.resolve(bug.slug).meta["gate"], ["v1", "beta"])
    assert.equal(ctx.repo.resolve(other.slug).meta["gate"], "beta")
    await assert.rejects(p.run("gate", "add", "nope", bug.slug), /no gate "nope"/)

    p.output.length = 0
    await p.run("gate", "show", "beta")
    const shown = p.output.join("\n")
    assert.match(shown, /beta — Public beta \(due 2026-02-01, 17 days left\): BLOCKED by 2/)
    assert.match(shown, /✗ bugs\/crash {2}Crash/)

    assert.equal(await p.run("gate", "remove", "beta", bug.slug), 0)
    assert.equal(ctx.repo.resolve(bug.slug).meta["gate"], "v1")
    assert.equal(await p.run("gate", "remove", "beta", other.slug), 0)
    assert.equal(ctx.repo.resolve(other.slug).meta["gate"], undefined)
    await assert.rejects(p.run("gate", "remove", "beta", other.slug), /is not on gate beta/)
  } finally {
    p.cleanup()
  }
})
