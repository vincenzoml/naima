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

const notesOf = async (ctx: Parameters<typeof runChecks>[0]) => (await runChecks(ctx)).notes.map((n) => n.message).join("\n")

test("a test names its evidence from the ranking; a passed regression test with no red run, or on inspection alone, is noted", async () => {
  const p = tempProject([trackers()])
  try {
    const { ctx } = p
    const bug = createItem(ctx, typeOrThrow(ctx, "bugs"), "Export drops alpha", { fixedOn: "2026-01-14" })
    const t = createItem(ctx, typeOrThrow(ctx, "tests"), "Export keeps alpha", { links: [{ rel: "verifies", id: bug.meta.id }] })
    ctx.reload()
    assert.throws(() => setFields(ctx, ctx.repo.resolve(t.slug), [["evidenceKind", "vibes"]]), /not one of/)
    setFields(ctx, ctx.repo.resolve(t.slug), [["status", "passed"], ["evidenceKind", "observation"]])
    ctx.reload()
    assert.match(await notesOf(ctx), /tests\/export-keeps-alpha passed as a regression test, and no red run is recorded/)
    setFields(ctx, ctx.repo.resolve(t.slug), [["redSeen", "2026-01-13"]])
    ctx.reload()
    assert.doesNotMatch(await notesOf(ctx), /no red run/)
    assert.throws(() => setFields(ctx, ctx.repo.resolve(t.slug), [["redSeen", "yesterday"]]), /date/)

    // A test that verifies a feature is no regression test: no red run is asked of it.
    const f = createItem(ctx, typeOrThrow(ctx, "features"), "Export as WebP", { fixedOn: "2026-01-14" })
    createItem(ctx, typeOrThrow(ctx, "tests"), "WebP export opens", {
      status: "passed",
      evidenceKind: "inspection",
      links: [{ rel: "verifies", id: f.meta.id }],
    })
    ctx.reload()
    const notes = await notesOf(ctx)
    assert.doesNotMatch(notes, /webp-export-opens passed as a regression test/)
    assert.match(notes, /tests\/webp-export-opens passed on inspection — "the code looks right" proves nothing/)
  } finally {
    p.cleanup()
  }
})

test("stale pages: an unticked clause naming a passed test, and an agent's test excusing itself, are notes", async () => {
  const p = tempProject([trackers()])
  try {
    const { ctx } = p
    const t = createItem(ctx, typeOrThrow(ctx, "tests"), "Export keeps alpha", { runBy: "agent" })
    const todo = createItem(ctx, typeOrThrow(ctx, "todos"), "Ship alpha export")
    writeFileSync(join(todo.dir, "README.md"), "# Ship alpha export\n\n- [x] code\n- [ ] proof: tests/export-keeps-alpha passes\n")
    ctx.reload()
    assert.doesNotMatch(await notesOf(ctx), /unticked clause names/)
    setFields(ctx, ctx.repo.resolve(t.slug), [["status", "passed"]])
    ctx.reload()
    assert.match(await notesOf(ctx), /todos\/ship-alpha-export: an unticked clause names tests\/export-keeps-alpha, which has passed/)
    writeFileSync(join(todo.dir, "README.md"), "# Ship alpha export\n\n- [x] code\n- [x] proof: tests/export-keeps-alpha passes\n")
    ctx.reload()
    assert.doesNotMatch(await notesOf(ctx), /unticked clause names/)

    // A clause can name its proof as "the linked test": it is stale once every item verifying the page has passed.
    const look = createItem(ctx, typeOrThrow(ctx, "todos"), "Logo looks right")
    writeFileSync(join(look.dir, "README.md"), "# Logo looks right\n\n- [ ] How it looks: the owner's call (the linked test item).\n")
    const eye = createItem(ctx, typeOrThrow(ctx, "tests"), "Logo judged by the owner", {
      runBy: "human",
      humanBecause: "judgement",
      links: [{ rel: "verifies", id: look.meta.id }],
    })
    ctx.reload()
    assert.doesNotMatch(await notesOf(ctx), /logo-looks-right: an unticked clause/)
    setFields(ctx, ctx.repo.resolve(eye.slug), [["status", "passed"]])
    ctx.reload()
    assert.match(await notesOf(ctx), /todos\/logo-looks-right: an unticked clause names its linked test, tests\/logo-judged-by-owner, which has passed/)

    // The title is not the page's excuse: only what the page says below it.
    createItem(ctx, typeOrThrow(ctx, "tests"), "Migrations are held by one format", { runBy: "agent" })
    ctx.reload()
    assert.doesNotMatch(await notesOf(ctx), /migrations-are-held/)

    const held = createItem(ctx, typeOrThrow(ctx, "tests"), "Render runs on the GPU box", { runBy: "agent" })
    writeFileSync(join(held.dir, "README.md"), "# Render runs on the GPU box\n\nNot run: the GPU box was held by another session.\n")
    ctx.reload()
    assert.match(await notesOf(ctx), /tests\/render-runs-gpu-box is runBy agent, and its page excuses it: "held by"/)
    setFields(ctx, ctx.repo.resolve(held.slug), [["status", "passed"]])
    ctx.reload()
    assert.doesNotMatch(await notesOf(ctx), /excuses it/)
  } finally {
    p.cleanup()
  }
})

test("the excuse phrases are the project's to set, and the stale-page notes can be weighed or switched off", async () => {
  const p = tempProject([trackers({ excusePhrases: ["waiting on the lab"] })])
  try {
    const { ctx } = p
    const a = createItem(ctx, typeOrThrow(ctx, "tests"), "A", { runBy: "agent" })
    writeFileSync(join(a.dir, "README.md"), "# A\n\nThe runner was held by another session.\n")
    const b = createItem(ctx, typeOrThrow(ctx, "tests"), "B", { runBy: "agent" })
    writeFileSync(join(b.dir, "README.md"), "# B\n\nWaiting on the lab.\n")
    ctx.reload()
    const notes = await notesOf(ctx)
    assert.doesNotMatch(notes, /tests\/a is runBy agent/)
    assert.match(notes, /tests\/b is runBy agent, and its page excuses it: "waiting on the lab"/)
    assert.throws(() => trackers({ excusePhrases: "busy" }), /excusePhrases must be a list of strings/)
  } finally {
    p.cleanup()
  }
  const off = tempProject([trackers()], { severities: { trackers: { "test-excuses-itself": "off" } } })
  try {
    const t = createItem(off.ctx, typeOrThrow(off.ctx, "tests"), "C", { runBy: "agent" })
    writeFileSync(join(t.dir, "README.md"), "# C\n\nHeld by another session.\n")
    off.ctx.reload()
    assert.doesNotMatch(await notesOf(off.ctx), /excuses it/)
  } finally {
    off.cleanup()
  }
})
