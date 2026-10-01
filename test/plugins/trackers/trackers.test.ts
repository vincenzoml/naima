import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import trackers, { lifecycle } from "../../../naima/src/plugins/trackers/index.ts"

test("fixed, resolved, closed are three states, and closing needs the proof", async () => {
  const p = tempProject([trackers()])
  try {
    const { ctx } = p
    const bug = createItem(ctx, typeOrThrow(ctx, "bugs"), "Export drops alpha")
    assert.equal(lifecycle(ctx, bug), "unfixed")
    await assert.rejects(() => p.run("close", bug.slug), /unfixed/)

    setFields(ctx, bug, [["fixedOn", "2026-01-14"]])
    ctx.reload()
    assert.equal(lifecycle(ctx, ctx.repo.resolve(bug.slug)), "fixed")
    assert.match((await runChecks(ctx)).notes.map((n) => n.message).join(), /fixed, and nothing verifies it/)

    const t = createItem(ctx, typeOrThrow(ctx, "tests"), "Export keeps alpha", { links: [{ rel: "verifies", id: bug.meta.id }] })
    ctx.reload()
    assert.equal(lifecycle(ctx, ctx.repo.resolve(bug.slug)), "fixed")
    await assert.rejects(() => p.run("close", bug.slug), /fixed/)

    setFields(ctx, ctx.repo.resolve(t.slug), [["status", "passed"]])
    ctx.reload()
    assert.equal(lifecycle(ctx, ctx.repo.resolve(bug.slug)), "resolved")
    assert.match((await runChecks(ctx)).notes.map((n) => n.message).join(), /is resolved/)

    assert.equal(await p.run("close", bug.slug), 0)
    const closed = ctx.repo.resolve(bug.meta.id)
    assert.deepEqual([closed.type, closed.meta.status, closed.meta["closedOn"], closed.meta["closedFrom"]], ["closed", "closed", "2026-01-15", "bugs"])
    assert.deepEqual((await runChecks(ctx)).problems, [])
  } finally {
    p.cleanup()
  }
})

test("an archived item without proof fails the check; archives cannot be opened", async () => {
  const p = tempProject([trackers()])
  try {
    await assert.rejects(() => p.run("new", "closed", "x"), /archive/)
    const bug = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Lost")
    const { moveItem } = await import("../../../naima/src/core/api.ts")
    setFields(p.ctx, bug, [["status", "wontfix"]])
    moveItem(p.ctx, bug, typeOrThrow(p.ctx, "closed"))
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join()
    assert.match(problems, /closed without a passed proof/)
    assert.match(problems, /status "wontfix"/)
  } finally {
    p.cleanup()
  }
})

test("bugs counts unfixed apart from fixed-but-unproven; partial must say what is left", async () => {
  const p = tempProject([trackers()])
  try {
    const { ctx } = p
    createItem(ctx, typeOrThrow(ctx, "bugs"), "One")
    const two = createItem(ctx, typeOrThrow(ctx, "bugs"), "Two", { fixedOn: "2026-01-10", status: "partial" })
    await p.run("bugs")
    const out = p.output.join("\n")
    assert.match(out, /unfixed \(no code\)\s+1/)
    assert.match(out, /fixed, not proven\s+1/)
    assert.match((await runChecks(ctx)).notes.map((n) => n.message).join(), /partial but its page has no unticked clause/)
    writeFileSync(join(two.dir, "README.md"), "# Two\n\n- [x] code\n- [ ] proof\n")
    assert.doesNotMatch((await runChecks(ctx)).notes.map((n) => n.message).join(), /no unticked clause/)
  } finally {
    p.cleanup()
  }
})

test("an item handed to a person says why, or check fails", async () => {
  const p = tempProject([trackers()])
  try {
    const { ctx } = p
    const t = createItem(ctx, typeOrThrow(ctx, "tests"), "The export looks right", { runBy: "human" })
    ctx.reload()
    assert.match((await runChecks(ctx)).problems.map((f) => f.message).join(), /handed to a person without saying why/)
    setFields(ctx, ctx.repo.resolve(t.slug), [["humanBecause", "judgement"]])
    ctx.reload()
    assert.equal((await runChecks(ctx)).problems.length, 0)
    assert.throws(() => setFields(ctx, ctx.repo.resolve(t.slug), [["humanBecause", "busy"]]), /not one of/)
  } finally {
    p.cleanup()
  }
})
