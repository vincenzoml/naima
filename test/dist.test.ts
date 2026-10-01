// The dist branch (docs/guide/install.md#the-dist-branch): a copy of the runtime
// folder naima/, the commit scripts/dist.ts builds from it, and a project that
// clones, locks, aligns and updates the dist, end to end through the launcher,
// offline — the source is a repository on this disk.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, posix } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { GUIDE_PAGES } from "../naima/src/core/cli.ts"
import { DIST_BRANCH, runtimeOf } from "../naima/src/core/internal.ts"
import { buildDist, selectRuntime, sourceCommit, TRAILER } from "../scripts/dist.ts"
import { gitIn as git, removeTemp } from "./core/testing.ts"

/** This checkout. */
const NAIMA = dirname(dirname(fileURLToPath(import.meta.url)))

/** Every file of this checkout that git tracks or would track: what a commit of it would hold. */
const tracked = git(NAIMA, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
  .split("\0")
  .filter((p) => p && existsSync(join(NAIMA, p)))
const runtime = selectRuntime(tracked)
/** The dist's files, by their path in the dist. */
const shipped = runtime.map(([, to]) => to)
const inDist = new Set(shipped)
/** A dist file's path in this checkout. */
const here = (f: string): string => join(NAIMA, runtime.find(([, to]) => to === f)?.[0] ?? f)

/** What only developing Naima needs: none of it reaches a project. */
const DEV_ONLY = [
  /\.test\.ts$/,
  /testing\.ts$/,
  /^test\//,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^\.claude\//,
  /^\.github\//,
  /^deno\.jsonc?$/,
  /^package\.json$/,
  /^scripts\//,
  /^site\//,
  /^naima-tracker\//,
]

test("the dist holds only what runs Naima: no test, no fixture, no CI, no agent rules, none of Naima's own items", () => {
  assert.ok(shipped.length > 40, `naima/ holds ${shipped.length} files`)
  for (const f of shipped) for (const dev of DEV_ONLY) assert.ok(!dev.test(f), `${f} ships, and it is development-only (${dev})`)
  assert.equal(shipped.filter((f) => f.endsWith(".test.ts")).length, 0)
  assert.equal(shipped.filter((f) => f.startsWith("naima-tracker/")).length, 0)
  for (const f of ["naima.ts", "src/cli.ts", "src/launcher.ts", "README.md", "LICENSE", "NOTICE", ...GUIDE_PAGES.map(([, p]) => p)]) {
    assert.ok(inDist.has(f), `${f} must ship`)
  }
  const modules = tracked.filter((f) => /^naima\/src\/.*\.ts$/.test(f)).map((f) => f.slice("naima/".length))
  assert.deepEqual(modules.filter((f) => !inDist.has(f)), [], "every runtime module ships")
  assert.equal(tracked.filter((f) => /\.test\.ts$/.test(f) && !f.startsWith("test/")).length, 0, "every test is under test/")
})

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g

test("every import in the dist resolves inside the dist, or is a node: built-in", () => {
  let seen = 0
  for (const file of shipped.filter((f) => f.endsWith(".ts"))) {
    for (const m of readFileSync(here(file), "utf8").matchAll(IMPORT)) {
      const spec = (m[1] ?? m[2]) as string
      seen++
      if (spec.startsWith("node:")) continue
      assert.ok(spec.startsWith("."), `${file} imports "${spec}", a package`)
      const target = posix.normalize(posix.join(posix.dirname(file), spec))
      assert.ok(inDist.has(target), `${file} imports ${target}, which the dist does not hold`)
    }
  }
  assert.ok(seen > 50, "the scanner is blind")
})

test("every relative link in the dist's markdown resolves inside the dist", () => {
  const dirs = new Set(shipped.flatMap((f) => f.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))))
  let seen = 0
  for (const file of shipped.filter((f) => f.endsWith(".md"))) {
    const text = readFileSync(here(file), "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "")
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = (m[1] as string).split("#")[0] as string
      if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue
      seen++
      const target = posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(link))).replace(/\/$/, "")
      assert.ok(inDist.has(target) || dirs.has(target), `${file} links ${link}, which the dist does not hold`)
    }
  }
  assert.ok(seen > 20, "the scanner is blind")
})

/** A copy of this checkout as a git repository with one commit on main: Naima's source, as CI sees it. */
function sourceRepo(base: string): string {
  const dir = join(base, "naima")
  for (const f of tracked) {
    const to = join(dir, f)
    mkdirSync(dirname(to), { recursive: true })
    if (lstatSync(join(NAIMA, f)).isSymbolicLink()) symlinkSync(readlinkSync(join(NAIMA, f)), to)
    else copyFileSync(join(NAIMA, f), to)
  }
  git(dir, "init", "-q", "-b", "main")
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", "Naima")
  return dir
}

const treeFiles = (repo: string, rev: string): string[] => git(repo, "ls-tree", "-r", "--name-only", rev).split("\n").filter(Boolean).sort()

test("the dist commit: a copy of naima/ in a main commit, traced by its trailer, rebuilt identically, and only when the runtime moved", () => {
  const base = mkdtempSync(join(tmpdir(), "naima-distbuild-"))
  try {
    const repo = sourceRepo(base)
    const main = git(repo, "rev-parse", "HEAD")
    const first = buildDist(repo)
    assert.ok(first.created)
    assert.deepEqual(treeFiles(repo, DIST_BRANCH), shipped, "the dist tree is naima/, exactly")
    assert.equal(sourceCommit(repo, first.commit), main, `${TRAILER} names the main commit`)
    assert.equal(git(repo, "rev-parse", "HEAD"), main, "main and the working tree are untouched")

    git(repo, "branch", "-q", "-D", DIST_BRANCH)
    assert.equal(buildDist(repo).commit, first.commit, "the same main commit gives the same dist commit")

    writeFileSync(join(repo, "naima-tracker", "naima-data", "note.txt"), "a tracker change\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "tracker only")
    const same = buildDist(repo)
    assert.deepEqual({ created: same.created, commit: same.commit }, { created: false, commit: first.commit }, "no runtime change: no dist commit")

    writeFileSync(join(repo, "naima", "docs", "README.md"), readFileSync(join(repo, "naima", "docs", "README.md"), "utf8") + "\nMore.\n")
    git(repo, "commit", "-q", "-am", "docs change")
    const next = buildDist(repo)
    assert.ok(next.created)
    assert.equal(git(repo, "rev-parse", `${next.commit}^`), first.commit, "the dist grows linearly: never rewritten")
    assert.equal(sourceCommit(repo, next.commit), git(repo, "rev-parse", "HEAD"))
    const late = buildDist(repo, main)
    assert.deepEqual(
      { created: late.created, commit: late.commit },
      { created: false, commit: next.commit },
      "a late run for an older commit never moves the dist back",
    )
  } finally {
    removeTemp(base)
  }
})

// ---- a project on the dist, through the launcher ----

const hasDeno = spawnSync("deno", ["--version"]).status === 0

function launch(launcher: string, cwd: string, ...args: string[]) {
  const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: "1", NAIMA_DATA: undefined, NAIMA_LAUNCHED: undefined }
  const r = spawnSync("deno", ["run", "-A", launcher, ...args], { cwd, encoding: "utf8", env })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}
const naima = (cwd: string, ...args: string[]) => launch(join(git(cwd, "rev-parse", "--show-toplevel"), "naima-tracker", "naima", "naima.ts"), cwd, ...args)
const lockOf = (host: string) => JSON.parse(readFileSync(join(host, "naima-tracker", "naima-data", "naima.json"), "utf8"))
const programOf = (host: string) => join(host, "naima-tracker", "naima")

/** The files on disk under `dir`, git's own directory aside. */
function onDisk(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (rel === ".git") return []
    return e.isDirectory() ? onDisk(dir, rel) : [rel]
  }).sort()
}

function world() {
  const base = mkdtempSync(join(tmpdir(), "naima-distworld-"))
  const source = sourceRepo(base)
  buildDist(source)
  const host = join(base, "project")
  mkdirSync(host)
  writeFileSync(join(host, "README.md"), "# A project\n")
  git(host, "init", "-q", "-b", "main")
  git(host, "add", "-A")
  git(host, "commit", "-q", "-m", "init")
  return { base, source, host, cleanup: () => removeTemp(base) }
}

test("a project clones the dist: its program holds exactly naima/, and init, check, new, guide, a new worktree and update all work on it", {
  skip: !hasDeno && "deno is not on PATH",
}, () => {
  const w = world()
  try {
    git(w.host, "clone", "-q", "--branch", DIST_BRANCH, "--", w.source, "naima-tracker/naima")
    const init = naima(w.host, "init")
    assert.equal(init.code, 0, init.err)
    const dist = git(w.source, "rev-parse", DIST_BRANCH)
    assert.equal(lockOf(w.host).commit, dist, "the lock names the dist commit")
    assert.deepEqual(onDisk(programOf(w.host)), shipped, "the program directory is naima/: 0 tests, 0 items, no agent rules")
    assert.equal(naima(w.host, "new", "bugs", "Something broke").code, 0)
    const check = naima(w.host, "check")
    assert.equal(check.code, 0, check.out + check.err)
    assert.match(check.out, /1 item/)
    const guide = naima(w.host, "guide")
    assert.equal(guide.code, 0, guide.err)
    for (const m of guide.out.matchAll(/^ {2}\S+\s+(\S+)$/gm)) assert.ok(existsSync(join(w.host, m[1] as string)), `guide names ${m[1]}, which exists`)
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")

    // A new worktree, with the source gone: its program is cloned from the main worktree's, still the dist.
    renameSync(w.source, `${w.source}.away`)
    const tree = join(w.base, "worktree")
    git(w.host, "worktree", "add", "-q", tree)
    const inTree = launch(join(programOf(w.host), "naima.ts"), tree, "check")
    assert.equal(inTree.code, 0, inTree.err)
    assert.equal(git(programOf(tree), "rev-parse", "HEAD"), dist)
    assert.deepEqual(onDisk(programOf(tree)), shipped, "the second worktree's program is naima/ too")
    renameSync(`${w.source}.away`, w.source)

    // Main moves the runtime; CI rebuilds the dist; update follows the dist.
    writeFileSync(join(w.source, "naima", "docs", "README.md"), readFileSync(join(w.source, "naima", "docs", "README.md"), "utf8") + "\nMoved.\n")
    git(w.source, "commit", "-q", "-am", "docs moved")
    const moved = buildDist(w.source).commit
    const asked = naima(w.host, "update", "--check")
    assert.equal(asked.code, 1, asked.err)
    assert.match(asked.out, /the source's dist moved/)
    const up = naima(w.host, "update")
    assert.equal(up.code, 0, up.err)
    assert.equal(lockOf(w.host).commit, moved)
    assert.equal(git(programOf(w.host), "rev-parse", "HEAD"), moved)
    assert.deepEqual(onDisk(programOf(w.host)), shipped)
    assert.match(naima(w.host, "update", "--check").out, /current: the source's dist is the locked commit/)
  } finally {
    w.cleanup()
  }
})

test("a project locked to a commit of main keeps working, and naima update moves it onto the dist", { skip: !hasDeno && "deno is not on PATH" }, () => {
  const w = world()
  try {
    git(w.host, "clone", "-q", "--branch", "main", "--", w.source, "naima-tracker/naima") // the install before the dist
    // A commit of main holds the runtime in naima/: its launcher is there until the update moves the program onto the dist.
    const naima = (cwd: string, ...args: string[]) => launch(join(runtimeOf(programOf(w.host)) ?? programOf(w.host), "naima.ts"), cwd, ...args)
    assert.ok(existsSync(join(programOf(w.host), "naima", "naima.ts")), "a main commit's launcher is naima/naima.ts")
    assert.equal(naima(w.host, "init").code, 0)
    const main = git(w.source, "rev-parse", "main")
    assert.equal(lockOf(w.host).commit, main)
    assert.equal(naima(w.host, "check").code, 0, "a lock on main still aligns and runs")
    const up = naima(w.host, "update")
    assert.equal(up.code, 0, up.err)
    const dist = git(w.source, "rev-parse", DIST_BRANCH)
    assert.equal(lockOf(w.host).commit, dist)
    assert.equal(sourceCommit(w.source, dist), main, "the same code, now without what does not run")
    assert.equal(onDisk(programOf(w.host)).filter((f) => f.endsWith(".test.ts")).length, 0)
    assert.deepEqual(onDisk(programOf(w.host)), shipped, "after the update, the program is naima/ exactly")
  } finally {
    w.cleanup()
  }
})

test("a program is cloned from this disk even when the dist commit is only a remote-tracking ref there, as in Naima's own repository", {
  skip: !hasDeno && "deno is not on PATH",
}, () => {
  const w = world()
  try {
    git(w.host, "clone", "-q", "--branch", DIST_BRANCH, "--", w.source, "naima-tracker/naima")
    assert.equal(naima(w.host, "init").code, 0)
    git(w.host, "fetch", "-q", "--", w.source, `${DIST_BRANCH}:refs/remotes/origin/${DIST_BRANCH}`)
    rmSync(programOf(w.host), { recursive: true, force: true })
    renameSync(w.source, `${w.source}.away`) // no network: only this disk
    const r = launch(join(NAIMA, "naima", "naima.ts"), w.host, "check")
    assert.equal(r.code, 0, r.err)
    assert.equal(git(programOf(w.host), "rev-parse", "HEAD"), lockOf(w.host).commit)
  } finally {
    w.cleanup()
  }
})
