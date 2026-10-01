// The non-stop loop: a target chosen before starting, a verdict each tick, and the owner's ordered action list once it stops.

import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, type Plugin, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import epics from "../../../naima/src/plugins/epics/index.ts"
import gates from "../../../naima/src/plugins/gates/index.ts"
import loop from "../../../naima/src/plugins/loop/index.ts"

const open = { category: "open" as const, says: "" }
const fixture = (): Plugin => ({
  name: "fixture",
  says: "work items and proofs",
  types: [
    { id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open, closed: { category: "done", says: "" } }, initialStatus: "open" },
    {
      id: "tests",
      dir: "TESTS",
      title: "",
      says: "",
      statuses: { open, passed: { category: "done", proves: true, says: "" }, failed: { category: "open", says: "" } },
      initialStatus: "open",
    },
  ],
  fields: [
    { name: "fixedOn", kind: "date", says: "" },
    {
      name: "runBy",
      kind: "enum",
      says: "",
      values: { agent: "a command", "agent-hands": "the running software", human: "a person", build: "an artefact nobody here makes" },
    },
    {
      name: "humanBecause",
      kind: "enum",
      says: "",
      values: { judgement: "how it looks", decision: "a decision reserved to the owner", credential: "a secret", physical: "a physical act" },
    },
  ],
  relations: [
    { name: "verifies", inverse: "verified-by", says: "" },
    { name: "verified-by", inverse: "verifies", says: "" },
  ],
})

const project = (options: Record<string, unknown> = {}) =>
  tempProject([fixture(), gates({ gates: { beta: { title: "Public beta" } } }), epics(), loop(options)])

test("naima loop refuses to start without a target, or on one it does not know", async () => {
  const p = project()
  try {
    await assert.rejects(p.run("loop"), /name the target/)
    await assert.rejects(p.run("loop", "nowhere"), /no gate or item "nowhere"/)
    const { ctx } = p
    const bare = createItem(ctx, typeOrThrow(ctx, "bugs"), "No steps")
    writeFileSync(join(bare.dir, "README.md"), "# No steps\n\nJust prose.\n")
    await assert.rejects(p.run("loop", bare.slug), /lists no steps/)
  } finally {
    p.cleanup()
  }
})

test("a work list stops when every line is done or carries a written deferral", async () => {
  const p = project()
  try {
    const { ctx } = p
    const list = createItem(ctx, typeOrThrow(ctx, "bugs"), "Tonight")
    const write = (body: string) => writeFileSync(join(list.dir, "README.md"), `# Tonight\n\n${body}`)
    write("- [x] merge the docs branch\n- [ ] rerun the gates\n- [ ] pick the licence — deferred: a decision reserved to the owner\n")
    assert.equal(await p.run("loop", list.slug, "--check"), 1)
    let out = p.output.join("\n")
    assert.match(out, /work list bugs\/tonight .*wake every 3 minutes/)
    assert.match(out, /1 of 3 done/)
    assert.match(out, /NOT DONE/)
    assert.match(out, /→ bugs\/tonight#2 {2}rerun the gates/)
    p.output.length = 0
    write("- [x] merge the docs branch\n- [X] rerun the gates\n- [ ] pick the licence — deferred: a decision reserved to the owner\n")
    assert.equal(await p.run("loop", list.slug, "--check", "--every", "5"), 0)
    out = p.output.join("\n")
    assert.match(out, /wake every 5 minutes/)
    assert.match(out, /STOPPED/)
    assert.match(out, /1\. bugs\/tonight#3 {2}pick the licence — a decision reserved to the owner/)
    p.output.length = 0
    await p.run("loop", list.slug, "--json")
    const r = JSON.parse(p.output.join("\n"))
    assert.deepEqual([r.kind, r.done, r.total, r.stopped, r.every, r.next, r.owner.length], ["list", 2, 3, true, 5, [], 1])
    assert.ok(r.tick.some((t: string) => /am I done, or did I stop\?/.test(t)))
  } finally {
    p.cleanup()
  }
})

test("an epic stops when every item is closed or needs only the owner, who gets them in order with why", async () => {
  const p = project({ every: 4 })
  try {
    const { ctx } = p
    const epic = createItem(ctx, typeOrThrow(ctx, "epics"), "Beta polish")
    const code = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash")
    const look = createItem(ctx, typeOrThrow(ctx, "tests"), "Looks right", { runBy: "human", humanBecause: "judgement" })
    const pick = createItem(ctx, typeOrThrow(ctx, "bugs"), "Pick a name", { humanBecause: "decision" })
    await p.run("epic", "add", epic.slug, code.slug, look.slug, pick.slug)
    p.output.length = 0
    assert.equal(await p.run("loop", `epics/${epic.slug}`, "--json"), 0)
    let r = JSON.parse(p.output.join("\n"))
    assert.deepEqual([r.kind, r.every, r.stopped, r.next.map((n: { ref: string }) => n.ref)], ["epic", 4, false, ["bugs/crash"]])
    assert.match(r.next[0].why, /no code yet/)
    // The fix lands; its proof is agent work until it is run.
    setFields(ctx, ctx.repo.resolve(code.slug), [["fixedOn", "2026-01-14"], ["runBy", "agent"]])
    p.output.length = 0
    await p.run("loop", `epics/${epic.slug}`, "--json")
    r = JSON.parse(p.output.join("\n"))
    assert.deepEqual([r.stopped, r.next.map((n: { why: string }) => n.why)], [false, ["owes its proof: run it (runBy agent)"]])
    setFields(ctx, ctx.repo.resolve(code.slug), [["status", "closed"]])
    p.output.length = 0
    assert.equal(await p.run("loop", `epics/${epic.slug}`, "--check"), 0)
    const out = p.output.join("\n")
    assert.match(out, /STOPPED/)
    // A reserved decision comes before a judgement.
    assert.match(
      out,
      /1\. bugs\/pick-a-name {2}Pick a name — decision: a decision reserved to the owner\n.*2\. tests\/looks-right {2}Looks right — judgement: how it looks/,
    )
    // Nobody has run the judgement test yet: while the owner is away, it is tried.
    assert.match(out, /nobody has tried yet[^\n]*\n\s+· tests\/looks-right/)
  } finally {
    p.cleanup()
  }
})

test("a gate stops when it holds only the owner's work", async () => {
  const p = project()
  try {
    const { ctx } = p
    const a = createItem(ctx, typeOrThrow(ctx, "bugs"), "Crash", { gate: "beta" })
    createItem(ctx, typeOrThrow(ctx, "bugs"), "Signed build", { gate: "beta", fixedOn: "2026-01-10", runBy: "build" })
    assert.equal(await p.run("loop", "beta", "--check"), 1)
    assert.match(p.output.join("\n"), /gate beta .*Public beta/)
    setFields(ctx, ctx.repo.resolve(a.slug), [["status", "closed"]])
    p.output.length = 0
    await p.run("loop", "beta", "--json")
    const r = JSON.parse(p.output.join("\n"))
    assert.deepEqual([r.kind, r.stopped, r.owner.map((o: { ref: string }) => o.ref)], ["gate", true, ["bugs/signed-build"]])
    assert.match(r.owner[0].why, /^build: an artefact nobody here makes/)
  } finally {
    p.cleanup()
  }
})
