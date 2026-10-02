import assert from "node:assert/strict"
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { type Context, createItem, DEFAULT_DATA, type Plugin, runChecks, setFields } from "../../../naima/src/core/api.ts"
import { createContext, DEFAULT_PROGRAM, gitIn, tempProject } from "../../core/testing.ts"
import coordination, { ACK_REQUIRED_FROM, readClaims, readPasses } from "../../../naima/src/plugins/coordination/index.ts"

// What coordination uses of whatever plugin declares a project's rules: plugins never import each
// other, so a stand-in declares the fields a rule carries, the way the real rules plugin does.
const ruleStandIn: Plugin = {
  name: "rules-stand-in",
  says: "test rules",
  types: [{
    id: "rules",
    dir: "rules",
    title: "Rules",
    says: "",
    statuses: { active: { category: "done", says: "" } },
    initialStatus: "active",
  }],
  fields: [
    { name: "audience", kind: "enum", says: "", values: { agents: "", people: "", everyone: "" }, appliesTo: ["rules"] },
    { name: "strength", kind: "enum", says: "", values: { must: "", should: "" }, appliesTo: ["rules"] },
    { name: "ack", kind: "string", says: "", appliesTo: ["rules"] },
  ],
}

function ruleItem(ctx: Context, title: string, ack: string, strength = "must") {
  const item = createItem(ctx, ctx.registry.types.get("rules")!, title)
  setFields(ctx, item, [["audience", "agents"], ["strength", strength], ["ack", ack]])
  ctx.reload()
  return item
}

const things: Plugin = {
  name: "things",
  says: "test type",
  types: [{ id: "things", dir: "THINGS", title: "Things", says: "", statuses: { open: { category: "open", says: "" } }, initialStatus: "open" }],
}

test("a claim is one file on the claimer's branch, visible from every other", async () => {
  const p = tempProject([things, coordination()], { git: true })
  try {
    const { ctx } = p
    const a = createItem(ctx, ctx.registry.types.get("things")!, "Alpha")
    const b = createItem(ctx, ctx.registry.types.get("things")!, "Beta")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")

    p.git("checkout", "-q", "-b", "work")
    assert.equal(await p.run("claim", a.slug, b.slug, "--note", "why"), 0)
    assert.equal(readdirSync(join(ctx.trackerRoot, "claims")).length, 1)
    assert.equal(await p.run("claim", a.slug), 0) // idempotent, same file
    assert.equal(readdirSync(join(ctx.trackerRoot, "claims")).length, 1)
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "claim")

    p.git("checkout", "-q", "main")
    assert.ok(!existsSync(join(ctx.trackerRoot, "claims")), "main's working tree was never written")
    const seen = readClaims(ctx)
    assert.equal(seen.length, 1)
    assert.deepEqual([seen[0]?.branch, seen[0]?.local, seen[0]?.items.length, seen[0]?.note], ["work", false, 2, "why"])

    p.git("checkout", "-q", "-b", "other")
    p.output.length = 0
    await p.run("claim", a.slug)
    assert.match(p.output.join("\n"), /also claimed by work/)
    p.output.length = 0
    await p.run("claims")
    assert.match(p.output.join("\n"), /more than one branch/)

    await p.run("release", a.slug)
    assert.ok(!existsSync(join(ctx.trackerRoot, "claims")) || readdirSync(join(ctx.trackerRoot, "claims")).length === 0)
    await assert.rejects(() => p.run("release", a.slug), /holds no claim/)
  } finally {
    p.cleanup()
  }
})

test("prune finds claims whose branch is gone", async () => {
  const p = tempProject([things, coordination()], { git: true })
  try {
    const a = createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
    p.git("checkout", "-q", "-b", "gone")
    await p.run("claim", a.slug)
    p.git("checkout", "-q", "main")
    p.git("branch", "-q", "-D", "gone")
    p.output.length = 0
    await p.run("prune")
    assert.match(p.output.join("\n"), /gone\s+1 items/)
    await p.run("prune", "--write")
    assert.equal(readClaims(p.ctx).length, 0)
  } finally {
    p.cleanup()
  }
})

test("session notes are one file each, newest first by instant", async () => {
  let clock = new Date("2026-01-15T09:00:00Z")
  const p = tempProject([coordination()], { git: true })
  try {
    Object.assign(p.ctx, { now: () => clock })
    await p.run("pass", "first")
    clock = new Date("2026-01-15T17:00:00Z")
    await p.run("pass", "second")
    const passes = readPasses(p.ctx)
    assert.deepEqual(passes.map((s) => s.body), ["second", "first"])
    p.output.length = 0
    await p.run("summary")
    assert.match(p.output.join("\n"), /where we were[\s\S]*second[\s\S]*\+1 more that day/)
  } finally {
    p.cleanup()
  }
})

test("a count that is not a positive whole number is a usage error, not an empty listing", async () => {
  const p = tempProject([things, coordination()], { git: true })
  try {
    for (const bad of ["all", "0", "1.5", ""]) await assert.rejects(p.run("pass", "--list", bad), /pass --list: the count must be a positive whole number/, bad)
    assert.equal(await p.run("pass", "--list", "3"), 0)
  } finally {
    p.cleanup()
  }
})

test("a claim belongs to a branch: on a detached HEAD it is refused", async () => {
  const p = tempProject([things, coordination()], { git: true })
  try {
    const a = createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    p.git("checkout", "-q", "--detach")
    await assert.rejects(p.run("claim", a.slug), /HEAD is detached: a claim belongs to a branch/)
    assert.ok(!existsSync(join(p.ctx.trackerRoot, "claims")))
  } finally {
    p.cleanup()
  }
})

/** A second worktree of `p`'s repository, on a new branch, with its own context. */
function worktree(p: ReturnType<typeof tempProject>, branch: string) {
  const root = `${p.root}-${branch}`
  p.git("worktree", "add", "-q", "-b", branch, root)
  const output: string[] = []
  const ctx = createContext({ root, data: join(root, DEFAULT_DATA), program: join(root, DEFAULT_DATA, DEFAULT_PROGRAM) }, p.ctx.config, p.ctx.registry, {
    out: (l = "") => void output.push(l),
    err: () => {},
    now: () => new Date("2026-01-15T10:00:00Z"),
  })
  const run = (name: string, ...args: string[]) => {
    ctx.reload()
    return ctx.registry.commands.get(name)!.run(args, ctx)
  }
  const git = (...args: string[]) => gitIn(root, ...args)
  return { root, ctx, output, run, git, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

test("a branch's own claim is read from its branch, not from a stale copy the reader's disk carries", async () => {
  const p = tempProject([things, coordination()], { git: true })
  const w = worktree(p, "w")
  try {
    createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
    createItem(p.ctx, p.ctx.registry.types.get("things")!, "Beta")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    w.git("merge", "-q", "--ff-only", "main")
    await w.run("claim", "alpha")
    w.git("add", "-A")
    w.git("commit", "-q", "-m", "claim alpha")
    p.git("merge", "-q", "--ff-only", "w") // the first batch lands: main's disk now carries w's claim file
    await w.run("claim", "beta")
    w.git("add", "-A")
    w.git("commit", "-q", "-m", "claim beta")
    const seen = readClaims(p.ctx).find((c) => c.branch === "w")
    assert.deepEqual([seen?.items.map((e) => e.ref).sort(), seen?.local], [["things/alpha", "things/beta"], false])
  } finally {
    w.cleanup()
    p.cleanup()
  }
})

test("a released claim stays released: the trunk's copy does not bring it back, and a new claim reuses the file", async () => {
  const p = tempProject([things, coordination()], { git: true })
  const w = worktree(p, "w")
  try {
    createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    w.git("merge", "-q", "--ff-only", "main")
    await w.run("claim", "alpha")
    w.git("add", "-A")
    w.git("commit", "-q", "-m", "claim alpha")
    p.git("merge", "-q", "--ff-only", "w")
    const [file] = readdirSync(join(w.ctx.trackerRoot, "claims"))
    assert.equal(await w.run("release", "alpha"), 0) // the deletion is not committed yet
    assert.deepEqual(readClaims(w.ctx), [])
    await assert.rejects(Promise.resolve().then(() => w.run("release", "alpha")), /holds no claim/)
    assert.equal(await w.run("claim", "alpha"), 0)
    assert.deepEqual(readdirSync(join(w.ctx.trackerRoot, "claims")), [file])
    assert.deepEqual(readClaims(w.ctx).map((c) => [c.branch, c.items.length]), [["w", 1]])
  } finally {
    w.cleanup()
    p.cleanup()
  }
})

test("prune lists a stale claim another ref carries, naming the ref it must be dropped from", async () => {
  const p = tempProject([things, coordination()], { git: true })
  try {
    const a = createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    p.git("checkout", "-q", "-b", "gone")
    await p.run("claim", a.slug)
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "claim")
    p.git("checkout", "-q", "-b", "carrier") // carries gone's claim file
    p.git("checkout", "-q", "main")
    p.git("branch", "-q", "-D", "gone")
    p.output.length = 0
    assert.equal(await p.run("prune"), 0)
    const out = p.output.join("\n")
    assert.doesNotMatch(out, /every claim names a branch that exists/)
    assert.match(out, /gone\s+1 items\s+\S+\.json\s+on carrier: drop it there/)
    p.output.length = 0
    await p.run("prune", "--write")
    assert.match(p.output.join("\n"), /removed 0 here; 1 must be dropped on its ref/)
  } finally {
    p.cleanup()
  }
})

test("two workers' uncommitted claims, in their own worktrees, are seen by each other and by the trunk", async () => {
  const p = tempProject([things, coordination()], { git: true })
  const at = (root: string) => {
    const out: string[] = []
    const ctx = createContext({ root, data: join(root, DEFAULT_DATA), program: join(root, DEFAULT_DATA, DEFAULT_PROGRAM) }, p.ctx.config, p.ctx.registry, {
      out: (l = "") => void out.push(l),
      err: () => {},
      now: () => new Date("2026-01-15T10:00:00Z"),
    })
    return { ctx, out, run: (cmd: string, ...args: string[]) => p.ctx.registry.commands.get(cmd)!.run(args, ctx) }
  }
  const w1 = `${p.root}-w1`
  const w2 = `${p.root}-w2`
  try {
    createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    p.git("worktree", "add", "-q", "-b", "w1", w1)
    p.git("worktree", "add", "-q", "-b", "w2", w2)
    const a = at(w1)
    const b = at(w2)
    await a.run("claim", "alpha")
    await b.run("claim", "alpha")
    assert.match(b.out.join("\n"), /also claimed by w1/, "the second worker is told")
    const trunk = at(p.root)
    await trunk.run("claims")
    assert.match(trunk.out.join("\n"), /claimed by more than one branch[\s\S]*things\/alpha → w1, w2|things\/alpha → w2, w1/)
    // w1 releases, not yet committed: gone from every view.
    await a.run("release", "alpha")
    assert.deepEqual(readClaims(trunk.ctx).filter((c) => c.items.length).map((c) => c.branch), ["w2"])
  } finally {
    p.cleanup()
    rmSync(w1, { recursive: true, force: true })
    rmSync(w2, { recursive: true, force: true })
  }
})

test("a claim merged into the trunk and released on its branch, not yet committed, is gone from the trunk too", async () => {
  const p = tempProject([things, coordination()], { git: true })
  const w = `${p.root}-w`
  try {
    createItem(p.ctx, p.ctx.registry.types.get("things")!, "Alpha")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    p.git("worktree", "add", "-q", "-b", "w", w)
    const ctx = createContext({ root: w, data: join(w, DEFAULT_DATA), program: join(w, DEFAULT_DATA, DEFAULT_PROGRAM) }, p.ctx.config, p.ctx.registry, {
      out: () => {},
      err: () => {},
      now: () => new Date("2026-01-15T10:00:00Z"),
    })
    const run = (cmd: string, ...args: string[]) => p.ctx.registry.commands.get(cmd)!.run(args, ctx)
    await run("claim", "alpha")
    gitIn(w, "add", "-A")
    gitIn(w, "commit", "-q", "-m", "claim")
    p.git("merge", "-q", "--ff-only", "w")
    assert.deepEqual(readClaims(p.ctx).map((c) => c.branch), ["w"])
    await run("release", "alpha")
    assert.deepEqual(readClaims(p.ctx).filter((c) => c.items.length), [], "the trunk's copy is w's, and w deleted it")
  } finally {
    p.cleanup()
    rmSync(w, { recursive: true, force: true })
  }
})

test("an item closed by hand while this branch claims it fails naima check, as naima close would have refused it", async () => {
  const archive: Plugin = {
    name: "archive",
    says: "test archive",
    types: [{
      id: "archived",
      dir: "ARCHIVED",
      title: "Archived",
      says: "",
      statuses: { closed: { category: "done", says: "" } },
      initialStatus: "closed",
      creatable: false,
    }],
  }
  const p = tempProject([things, archive, coordination()], { git: true })
  try {
    const { ctx } = p
    const a = createItem(ctx, ctx.registry.types.get("things")!, "Alpha")
    p.git("checkout", "-q", "-b", "me/work")
    assert.equal(await p.run("claim", a.slug), 0)
    const problems = async () => (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.equal(await problems(), "")
    // the hand edit naima close refuses: the item's directory moved into the archive
    mkdirSync(join(ctx.trackerRoot, "ARCHIVED"), { recursive: true })
    const moved = join(ctx.trackerRoot, "ARCHIVED", a.slug)
    renameSync(a.dir, moved)
    const meta = join(moved, "meta.json")
    writeFileSync(meta, JSON.stringify({ ...JSON.parse(readFileSync(meta, "utf8")), status: "closed" }))
    p.ctx.reload()
    assert.match(await problems(), /archived\/alpha is closed, yet me\/work, the branch you are on, claims it.*release/)
    assert.equal(await p.run("release", a.slug), 0)
    assert.equal(await problems(), "")
  } finally {
    p.cleanup()
  }
})

test("pass --ack refuses a line missing a phrase the active rules ask for, and writes it first in the note otherwise", async () => {
  const p = tempProject([ruleStandIn, coordination()], { git: true })
  try {
    ruleItem(p.ctx, "Quiet mode", "Quiet mode on")
    ruleItem(p.ctx, "Fast mode", "Fast mode on")

    await assert.rejects(p.run("pass", "did the thing", "--ack", "Quiet mode on"), /pass --ack is missing: Fast mode on/)

    assert.equal(await p.run("pass", "did the thing", "--ack", "Acknowledge: Quiet mode on · Fast mode on"), 0)
    const [note] = readPasses(p.ctx)
    assert.equal(note?.ack, "Acknowledge: Quiet mode on · Fast mode on")
    assert.ok(note?.body.startsWith("Acknowledge: Quiet mode on · Fast mode on\n\ndid the thing"))
  } finally {
    p.cleanup()
  }
})

test("a session note is written without naming any rule: naima pass never demands --ack on its own", async () => {
  const p = tempProject([coordination()], { git: true })
  try {
    assert.equal(await p.run("pass", "no rules plugin here"), 0)
    const [note] = readPasses(p.ctx)
    assert.equal(note?.ack, undefined)
  } finally {
    p.cleanup()
  }
})

test("naima check: a session note dated after the cut-off missing its acknowledgement, or no longer starting with it, is a problem; one dated the cut-off day or earlier is grandfathered", async () => {
  const p = tempProject([ruleStandIn, coordination()], { git: true })
  try {
    ruleItem(p.ctx, "Quiet mode", "Quiet mode on")
    const problems = async () => (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    const dayAfter = new Date(`${ACK_REQUIRED_FROM}T00:00:00Z`)
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)

    Object.assign(p.ctx, { now: () => dayAfter })
    await p.run("pass", "no ack given")
    assert.match(await problems(), /carries no acknowledgement line/)

    const beforeDir = p.ctx.trackerRoot + "/passes"
    for (const f of readdirSync(beforeDir)) rmSync(join(beforeDir, f))
    p.ctx.reload()
    assert.equal(await problems(), "")

    await p.run("pass", "has an ack", "--ack", "Quiet mode on")
    assert.equal(await problems(), "")
    const [file] = readdirSync(beforeDir)
    const edited = readFileSync(join(beforeDir, file!), "utf8").replace("Quiet mode on\n\nhas an ack", "has an ack, edited after the fact")
    writeFileSync(join(beforeDir, file!), edited)
    p.ctx.reload()
    assert.match(await problems(), /no longer begins with the acknowledgement line/)

    for (const f of readdirSync(beforeDir)) rmSync(join(beforeDir, f))
    p.ctx.reload()
    Object.assign(p.ctx, { now: () => new Date(`${ACK_REQUIRED_FROM}T09:00:00Z`) }) // the cut-off day itself: grandfathered, like a closed item the day commits shipped
    await p.run("pass", "the day acknowledgement lines shipped, written before the plugin that checks them loaded")
    assert.equal(await problems(), "")

    for (const f of readdirSync(beforeDir)) rmSync(join(beforeDir, f))
    p.ctx.reload()
    Object.assign(p.ctx, { now: () => new Date("2026-01-01T09:00:00Z") }) // before the cut-off
    await p.run("pass", "an old note, from before acknowledgement lines began")
    assert.equal(await problems(), "")
  } finally {
    p.cleanup()
  }
})
