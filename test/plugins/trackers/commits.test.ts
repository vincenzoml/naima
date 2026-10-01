import assert from "node:assert/strict"
import { test } from "node:test"
import { createItem, type Item, moveItem, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

/** Fix up a bug to "resolved": fixedOn set, and a test item that verifies it and has passed. */
function resolve(p: ReturnType<typeof tempProject>, bug: Item) {
  setFields(p.ctx, bug, [["fixedOn", "2026-01-14"]])
  p.ctx.reload()
  const t = createItem(p.ctx, typeOrThrow(p.ctx, "tests"), "proves it", { links: [{ rel: "verifies", id: bug.meta.id }] })
  setFields(p.ctx, p.ctx.repo.resolve(t.slug), [["status", "passed"]])
  p.ctx.reload()
}

test("close refuses a resolved item with no commit reachable from the trunk", async () => {
  const p = tempProject([trackers()], { git: true })
  try {
    const bug = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Export drops alpha")
    resolve(p, bug)
    await assert.rejects(() => p.run("close", bug.slug), /commit.*reachable from the trunk/)
  } finally {
    p.cleanup()
  }
})

test("close succeeds once a real commit from the trunk is named", async () => {
  const p = tempProject([trackers()], { git: true })
  try {
    const bug = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Export drops alpha")
    resolve(p, bug)
    p.git("commit", "--allow-empty", "-q", "-m", "the fix")
    const hash = p.git("rev-parse", "HEAD")
    setFields(p.ctx, p.ctx.repo.resolve(bug.slug), [["commits", hash]])
    p.ctx.reload()
    assert.equal(await p.run("close", bug.slug), 0)
    const closed = p.ctx.repo.resolve(bug.meta.id)
    assert.deepEqual(closed.meta["commits"], [hash])
  } finally {
    p.cleanup()
  }
})

test("close --force closes without a commit", async () => {
  const p = tempProject([trackers()], { git: true })
  try {
    const bug = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Export drops alpha")
    resolve(p, bug)
    assert.equal(await p.run("close", bug.slug, "--force"), 0)
  } finally {
    p.cleanup()
  }
})

test("a check reports a commits hash git does not have", async () => {
  const p = tempProject([trackers()], { git: true })
  try {
    const bug = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Export drops alpha")
    setFields(p.ctx, bug, [["commits", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"]])
    p.ctx.reload()
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join()
    assert.match(problems, /deadbeefdeadbeefdeadbeefdeadbeefdeadbeef.*git does not have/)
  } finally {
    p.cleanup()
  }
})

test("a closed item from before the cutoff is not checked for a commit; one after it is", async () => {
  const p = tempProject([trackers({ commitsRequiredFrom: "2026-01-01" })], { git: true })
  try {
    const old = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Old one")
    setFields(p.ctx, old, [["status", "wontfix"]])
    p.ctx.reload()
    const closedOld = moveItem(p.ctx, p.ctx.repo.resolve(old.slug), typeOrThrow(p.ctx, "closed"))
    setFields(p.ctx, closedOld, [["status", "closed"], ["closedOn", "2025-12-31"]])
    p.ctx.reload()

    const recent = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Recent one")
    setFields(p.ctx, recent, [["status", "wontfix"]])
    p.ctx.reload()
    const closedRecent = moveItem(p.ctx, p.ctx.repo.resolve(recent.slug), typeOrThrow(p.ctx, "closed"))
    setFields(p.ctx, closedRecent, [["status", "closed"], ["closedOn", "2026-06-01"]])
    p.ctx.reload()

    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message)
    assert.ok(!problems.some((m) => m.includes("closed/old-one") && m.includes("commit")), problems.join("\n"))
    assert.ok(problems.some((m) => m.includes("closed/recent-one") && m.includes("commit")), problems.join("\n"))
  } finally {
    p.cleanup()
  }
})

test('commits=["legacy"] grandfathers an item closed the same day the rule shipped, without a guessed hash', async () => {
  // The cut-off is a date, not a timestamp: an item closed earlier the same day this
  // feature landed would otherwise be flagged. The migration marks it "legacy" instead
  // of inventing a hash — and "legacy" never satisfies naima close itself.
  const p = tempProject([trackers({ commitsRequiredFrom: "2026-01-01" })], { git: true })
  try {
    const old = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Closed this morning")
    setFields(p.ctx, old, [["status", "wontfix"]])
    p.ctx.reload()
    const closed = moveItem(p.ctx, p.ctx.repo.resolve(old.slug), typeOrThrow(p.ctx, "closed"))
    setFields(p.ctx, closed, [["status", "closed"], ["closedOn", "2026-01-15"], ["commits", "legacy"]])
    p.ctx.reload()

    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message)
    assert.ok(!problems.some((m) => m.includes("closed/closed-this-morning") && m.includes("commit")), problems.join("\n"))
    assert.ok(!problems.some((m) => m.includes("legacy") && m.includes("does not have")), "legacy is not flagged as a bad hash: " + problems.join("\n"))

    // "legacy" never satisfies naima close itself: a new item cannot close on it alone.
    const bug = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Another one")
    setFields(p.ctx, bug, [["fixedOn", "2026-01-15"], ["commits", "legacy"]])
    const t = createItem(p.ctx, typeOrThrow(p.ctx, "tests"), "proves it", { links: [{ rel: "verifies", id: bug.meta.id }] })
    setFields(p.ctx, p.ctx.repo.resolve(t.slug), [["status", "passed"]])
    p.ctx.reload()
    await assert.rejects(() => p.run("close", bug.slug), /reachable from the trunk/)
  } finally {
    p.cleanup()
  }
})
