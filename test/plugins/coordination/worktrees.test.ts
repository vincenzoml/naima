import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { test } from "node:test"
import { type CheckOptions, createItem, DEFAULT_DATA, type Plugin, runChecks } from "../../../naima/src/core/api.ts"
import { createContext, DEFAULT_PROGRAM, gitIn, removeTemp, tempProject } from "../../core/testing.ts"
import coordination, { readClaims } from "../../../naima/src/plugins/coordination/index.ts"

const things: Plugin = {
  name: "things",
  says: "test type",
  types: [{ id: "things", dir: "THINGS", title: "Things", says: "", statuses: { open: { category: "open", says: "" } }, initialStatus: "open" }],
}

/** A git project with one committed item, and the worktrees directory the policy expects beside it. */
function project(options: Record<string, unknown> = {}) {
  const p = tempProject([things, coordination(options)], { git: true })
  createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
  p.git("add", "-A")
  p.git("commit", "-q", "-m", "items")
  const dir = `${p.root}-worktrees`
  return { ...p, dir, cleanup: () => (removeTemp(dir), p.cleanup()) }
}

/** A context standing in another worktree of the same project. */
function at(p: ReturnType<typeof project>, root: string) {
  const out: string[] = []
  const ctx = createContext({ root, data: join(root, DEFAULT_DATA), program: join(root, DEFAULT_DATA, DEFAULT_PROGRAM) }, p.ctx.config, p.ctx.registry, {
    out: (l = "") => void out.push(l),
    err: () => {},
    now: () => new Date("2026-01-15T10:00:00Z"),
  })
  const run = (cmd: string, ...args: string[]) => {
    ctx.reload()
    return Promise.resolve().then(() => p.ctx.registry.commands.get(cmd)!.run(args, ctx))
  }
  return { ctx, out, run, git: (...args: string[]) => gitIn(root, ...args) }
}

const messages = async (ctx: ReturnType<typeof project>["ctx"], options?: CheckOptions) => {
  const { problems, notes } = await runChecks(ctx, options)
  return { problems: problems.map((f) => f.message).join("\n"), notes: notes.map((f) => f.message).join("\n") }
}

test("open makes the worktree, the branch and the claim in one step, by the naming scheme", async () => {
  const p = project()
  try {
    assert.equal(await p.run("open", "alpha", "--as", "agent", "--name", "fix-alpha", "--note", "why"), 0)
    const path = join(p.dir, "fix-alpha")
    assert.ok(existsSync(path), "the worktree is under the worktrees directory, named for the branch's last segment")
    assert.equal(gitIn(path, "rev-parse", "--abbrev-ref", "HEAD"), "agent/fix-alpha")
    const files = readdirSync(join(path, DEFAULT_DATA, "claims"))
    assert.equal(files.length, 1, "the claim is written in the new worktree")
    const claim = JSON.parse(readFileSync(join(path, DEFAULT_DATA, "claims", files[0]!), "utf8"))
    assert.deepEqual([claim.branch, claim.note, claim.items.map((e: { ref: string }) => e.ref)], ["agent/fix-alpha", "why", ["things/alpha"]])
    assert.equal(gitIn(path, "status", "--porcelain", "--untracked-files=all").split("\n").length, 1, "nothing staged or committed: one new file")
    assert.ok(!existsSync(join(p.ctx.trackerRoot, "claims")), "the trunk's disk is never written")
    assert.deepEqual(readClaims(p.ctx).map((c) => c.branch), ["agent/fix-alpha"])
    assert.equal((await messages(p.ctx)).problems, "", "a worktree open made holds to the policy")
    // The name defaults to the first item's slug.
    assert.equal(await p.run("open", "alpha", "--as", "agent"), 0)
    assert.ok(existsSync(join(p.dir, "alpha")))
  } finally {
    p.cleanup()
  }
})

test("open refuses what would break the scheme, and touches nothing when it does", async () => {
  const p = project()
  try {
    await assert.rejects(p.run("open", "alpha"), /--as <who>/)
    await assert.rejects(p.run("open", "alpha", "--as", "Agent"), /lowercase/)
    await assert.rejects(p.run("open", "alpha", "--as", "agent", "--name", "a/b"), /lowercase/)
    await assert.rejects(p.run("open", "nothing-like-it", "--as", "agent"), /nothing-like-it/)
    p.git("branch", "agent/taken")
    await assert.rejects(p.run("open", "alpha", "--as", "agent", "--name", "taken"), /already exists/)
    assert.ok(!existsSync(join(p.dir, "taken")))
    // A project that names who works by default needs no --as.
    const q = project({ who: "bot" })
    try {
      assert.equal(await q.run("open", "alpha"), 0)
      assert.equal(gitIn(join(q.dir, "alpha"), "rev-parse", "--abbrev-ref", "HEAD"), "bot/alpha")
    } finally {
      q.cleanup()
    }
  } finally {
    p.cleanup()
  }
})

test("the policy check fails a worktree or a branch off the scheme, and an unclaimed worktree with work on it", async () => {
  const p = project()
  try {
    p.git("worktree", "add", "-q", "-b", "agent/right", join(p.dir, "right"))
    p.git("worktree", "add", "-q", "-b", "agent/one", join(p.dir, "other"))
    p.git("worktree", "add", "-q", "-b", "agent/far", `${p.root}-far`)
    p.git("branch", "stray")
    let { problems, notes } = await messages(p.ctx)
    assert.match(problems, /worktree .*other is on agent\/one: its folder must be named one/)
    assert.match(problems, /worktree .*-far is outside .*-worktrees/)
    assert.match(problems, /branch stray is off the naming scheme <who>\/<what>/)
    assert.doesNotMatch(problems, /agent\/right/, "a worktree with nothing on it yet is a note, not a failure")
    assert.match(notes, /worktree .*right \(agent\/right\) carries no claim/)

    const right = at(p, join(p.dir, "right"))
    writeFileSync(join(p.dir, "right", "work.txt"), "x")
    right.git("add", "-A")
    right.git("commit", "-q", "-m", "work")
    ;({ problems, notes } = await messages(p.ctx))
    assert.doesNotMatch(
      problems,
      /agent\/right/,
      "a gate judges its own tree: another worktree's missing claim is never a problem on this one's check",
    )
    assert.match(
      notes,
      /worktree .*right \(agent\/right\) carries no claim and has 1 commit not on main/,
      "reported as a note, naming the worktree, so a human still sees it",
    )
    // The worktree being checked judges itself: from inside "right", the same state is a problem.
    assert.match((await messages(right.ctx)).problems, /worktree .*right \(agent\/right\) carries no claim and has 1 commit not on main/)
    // The coordinator's view sees every worktree as the worktree itself would.
    assert.match(
      (await messages(p.ctx, { allWorktrees: true })).problems,
      /worktree .*right \(agent\/right\) carries no claim and has 1 commit not on main/,
    )

    await right.run("claim", "alpha")
    ;({ problems } = await messages(p.ctx))
    assert.doesNotMatch(problems, /agent\/right/, "an uncommitted claim on its disk is enough")
    right.git("add", "-A")
    right.git("commit", "-q", "-m", "claim")
    await right.run("release", "alpha")
    right.git("add", "-A")
    right.git("commit", "-q", "-m", "release")
    ;({ problems } = await messages(p.ctx))
    assert.doesNotMatch(problems, /agent\/right/, "a claim released at closing still counts: its commits carried it")

    const exempt = project({ exempt: ["stray"], worktrees: `../${basename(p.root)}-worktrees` })
    try {
      exempt.git("branch", "stray")
      assert.equal((await messages(exempt.ctx)).problems, "")
    } finally {
      exempt.cleanup()
    }
  } finally {
    p.cleanup()
  }
})

test("a worktree that only files items passes with a session note, no claim needed", async () => {
  const p = project()
  try {
    await p.run("open", "alpha", "--as", "agent", "--name", "filer")
    const filer = at(p, join(p.dir, "filer"))
    await filer.run("release", "alpha") // filing, not working an item: nothing claimed, and nothing was yet committed to release
    writeFileSync(join(p.dir, "filer", "new-bug.txt"), "x")
    filer.git("add", "-A")
    filer.git("commit", "-q", "-m", "file a bug")
    assert.match((await messages(filer.ctx)).problems, /carries no claim/, "commits with no claim and no note are still a problem on its own check")

    await filer.run("pass", "filed a bug, nothing claimed")
    assert.equal((await messages(filer.ctx)).problems, "", "a session note alone is enough: no item was claimed because none was worked")
    assert.equal((await messages(p.ctx)).problems, "")
  } finally {
    p.cleanup()
  }
})

test("a preparing claim is told when the trunk takes a commit, and which were made on the trunk directly", async () => {
  const p = project()
  try {
    await p.run("open", "alpha", "--as", "agent", "--name", "ready")
    const w = at(p, join(p.dir, "ready"))
    assert.equal(await w.run("claim", "--preparing"), 0)
    assert.equal(readClaims(p.ctx)[0]?.preparing, true)
    w.git("add", "-A")
    w.git("commit", "-q", "-m", "claim")
    assert.doesNotMatch((await messages(p.ctx)).notes, /trunk/)

    writeFileSync(join(p.root, "direct.txt"), "x")
    p.git("add", "direct.txt")
    p.git("commit", "-q", "-m", "a commit on the trunk")
    const { notes, problems } = await messages(p.ctx)
    assert.match(notes, /main took 1 commit agent\/ready does not have, while it is being prepared: merge main into it again/)
    assert.match(notes, /[0-9a-f]{7} "a commit on the trunk" was committed on main directly, outside the flow, while agent\/ready was open/)
    assert.equal(problems, "")

    w.git("merge", "-q", "--no-edit", "main")
    assert.doesNotMatch((await messages(p.ctx)).notes, /main took|directly/, "merged in: nothing left to say")
    assert.equal(await w.run("release", "alpha"), 0)
    assert.deepEqual(readClaims(p.ctx).map((c) => [c.preparing, c.items.length]), [[true, 0]], "the last release keeps the mark while preparing")
    assert.equal(await w.run("claim", "--not-preparing"), 0)
    assert.equal(readClaims(p.ctx)[0]?.preparing, undefined)
    assert.equal(readdirSync(join(p.dir, "ready", DEFAULT_DATA, "claims")).length, 0, "dropping the mark removes the file it alone kept")
    await assert.rejects(at(p, p.root).run("claim", "--preparing"), /no claim/)
  } finally {
    p.cleanup()
  }
})

test("prune --branch deletes a branch and its worktree, and refuses unmerged work with no archive tag", async () => {
  const p = project()
  try {
    await p.run("open", "alpha", "--as", "agent", "--name", "done")
    await p.run("open", "alpha", "--as", "agent", "--name", "work")
    const work = at(p, join(p.dir, "work"))
    writeFileSync(join(p.dir, "work", "work.txt"), "x")
    work.git("add", "-A")
    work.git("commit", "-q", "-m", "unmerged work")
    const done = at(p, join(p.dir, "done"))
    done.git("add", "-A")
    done.git("commit", "-q", "-m", "claim")
    p.git("merge", "-q", "--ff-only", "agent/done")

    p.output.length = 0
    assert.equal(await p.run("prune", "--branch", "agent/work"), 0)
    assert.match(p.output.join("\n"), /agent\/work has 1 commit not on main and no archive\/agent\/work tag/)
    await assert.rejects(p.run("prune", "--branch", "agent/work", "--write"), /archive\/agent\/work/)
    assert.ok(existsSync(join(p.dir, "work")))
    assert.equal(gitIn(p.root, "branch", "--list", "--format=%(refname:short)", "agent/work").trim(), "agent/work")

    assert.equal(await p.run("prune", "--branch", "agent/work", "--archive", "--write"), 0)
    assert.match(gitIn(p.root, "log", "-1", "--format=%s", "archive/agent/work"), /unmerged work/, "the tag keeps the work")
    assert.ok(!existsSync(join(p.dir, "work")))
    assert.equal(gitIn(p.root, "branch", "--list", "--format=%(refname:short)", "agent/work").trim(), "")

    assert.equal(await p.run("prune", "--branch", "agent/done", "--write"), 0, "a merged branch needs no tag")
    assert.equal(gitIn(p.root, "branch", "--list", "--format=%(refname:short)", "agent/done").trim(), "")
    await assert.rejects(p.run("prune", "--branch", "main", "--write"), /trunk/)
  } finally {
    p.cleanup()
  }
})
