// The runtime folder, naima/: what a project's program is a copy of. It holds
// only what runs Naima, and is whole on its own — every import and every link
// resolves inside it; and a project installed from a source holding all of
// Naima's repository gets exactly naima/, through init, check, new, guide, a
// new worktree and an update, end to end through the launcher and offline
// once the commit is in the user's cache (docs/guide/install.md).

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, posix } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { GUIDE_PAGES } from "../naima/src/core/cli.ts"
import { COPY_FILE, RUNTIME_DIR } from "../naima/src/core/internal.ts"
import { gitIn as git, removeTemp, sourceRepo, trackedFiles } from "./core/testing.ts"

/** This checkout. */
const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const tracked = trackedFiles(REPO)
/** The runtime files, by their path in naima/: what a copy holds. */
const shipped = tracked.filter((p) => p.startsWith(`${RUNTIME_DIR}/`)).map((p) => p.slice(RUNTIME_DIR.length + 1)).sort()
const inCopy = new Set(shipped)
const here = (f: string): string => join(REPO, RUNTIME_DIR, f)

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

test("naima/ holds only what runs Naima: no test, no fixture, no CI, no agent rules, none of Naima's own items", () => {
  assert.ok(shipped.length > 40, `naima/ holds ${shipped.length} files`)
  for (const f of shipped) for (const dev of DEV_ONLY) assert.ok(!dev.test(f), `${f} is copied, and it is development-only (${dev})`)
  for (const f of ["naima.ts", "src/cli.ts", "src/launcher.ts", "README.md", "LICENSE", "NOTICE", ...GUIDE_PAGES.map(([, p]) => p)]) {
    assert.ok(inCopy.has(f), `${f} must be copied`)
  }
  assert.ok(!inCopy.has(COPY_FILE), "the copy record is written by the copy, never committed in naima/")
  assert.equal(tracked.filter((f) => /\.test\.ts$/.test(f) && !f.startsWith("test/")).length, 0, "every test is under test/")
})

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g

test("every import in naima/ resolves inside naima/, or is a node: built-in", () => {
  let seen = 0
  for (const file of shipped.filter((f) => f.endsWith(".ts"))) {
    for (const m of readFileSync(here(file), "utf8").matchAll(IMPORT)) {
      const spec = (m[1] ?? m[2]) as string
      seen++
      if (spec.startsWith("node:")) continue
      assert.ok(spec.startsWith("."), `${file} imports "${spec}", a package`)
      const target = posix.normalize(posix.join(posix.dirname(file), spec))
      assert.ok(inCopy.has(target), `${file} imports ${target}, which naima/ does not hold`)
    }
  }
  assert.ok(seen > 50, "the scanner is blind")
})

test("every relative link in naima/'s markdown resolves inside naima/", () => {
  const dirs = new Set(shipped.flatMap((f) => f.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))))
  let seen = 0
  for (const file of shipped.filter((f) => f.endsWith(".md"))) {
    const text = readFileSync(here(file), "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "")
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const link = (m[1] as string).split("#")[0] as string
      if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue
      seen++
      const target = posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(link))).replace(/\/$/, "")
      assert.ok(inCopy.has(target) || dirs.has(target), `${file} links ${link}, which naima/ does not hold`)
    }
  }
  assert.ok(seen > 20, "the scanner is blind")
})

// ---- a project installed from all of Naima's repository, through the launcher ----

const hasDeno = spawnSync("deno", ["--version"]).status === 0

/** The files on disk under `dir`, with forward slashes. */
function onDisk(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    return e.isDirectory() ? onDisk(dir, rel) : [rel]
  }).sort()
}

test("a project's program holds exactly naima/, and init, check, new, guide, a new worktree and update all work on it", {
  skip: !hasDeno && "deno is not on PATH",
  timeout: 30_000, // many git and Deno subprocesses: past Bun's 5 second default (bugs/bun-s-5-second-default-test-timeout)
}, () => {
  const base = mkdtempSync(join(tmpdir(), "naima-runtime-"))
  try {
    const source = sourceRepo(REPO, join(base, "naima"))
    const cache = join(base, "cache")
    const launch = (launcher: string, cwd: string, ...args: string[]) => {
      const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: "1", NAIMA_DATA: undefined, NAIMA_LAUNCHED: undefined, NAIMA_CACHE: cache }
      const r = spawnSync("deno", ["run", "-A", launcher, ...args], { cwd, encoding: "utf8", env })
      return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
    }
    const programOf = (host: string) => join(host, "naima-tracker", "naima")
    const naima = (host: string, ...args: string[]) => launch(join(programOf(host), "naima.ts"), host, ...args)
    const host = join(base, "project")
    mkdirSync(host)
    writeFileSync(join(host, "README.md"), "# A project\n")
    git(host, "init", "-q", "-b", "main")
    git(host, "add", "-A")
    git(host, "commit", "-q", "-m", "init")
    const runtime = git(source, "ls-tree", "-r", "--name-only", `HEAD:${RUNTIME_DIR}`).split("\n").sort()
    assert.deepEqual(runtime, shipped, "the source's naima/ is this checkout's")

    const installer = join(base, "installer")
    git(base, "clone", "-q", "--", source, installer)
    const init = launch(join(installer, RUNTIME_DIR, "naima.ts"), host, "init")
    assert.equal(init.code, 0, init.err)
    rmSync(installer, { recursive: true, force: true })
    const main = git(source, "rev-parse", "main")
    assert.equal(JSON.parse(readFileSync(join(host, "naima-tracker", "naima-data", "naima.json"), "utf8")).commit, main, "the lock names main's commit")
    assert.deepEqual(onDisk(programOf(host)), [COPY_FILE, ...shipped].sort(), "the program directory is naima/: 0 tests, 0 items, no agent rules")
    assert.equal(naima(host, "new", "bugs", "Something broke").code, 0)
    const check = naima(host, "check")
    assert.equal(check.code, 0, check.out + check.err)
    assert.match(check.out, /1 item/)
    const guide = naima(host, "guide")
    assert.equal(guide.code, 0, guide.err)
    assert.match(guide.out, new RegExp(`^Naima ${main.slice(0, 12)},`, "m"))
    for (const m of guide.out.matchAll(/^ {2}\S+\s+(\S+)$/gm)) assert.ok(existsSync(join(host, m[1] as string)), `guide names ${m[1]}, which exists`)
    git(host, "add", "-A")
    git(host, "commit", "-q", "-m", "Track with Naima")

    // A new worktree, with the source gone: its program is copied from the user's cache.
    renameSync(source, `${source}.away`)
    const tree = `${host}-worktrees/worktree` // by the naming scheme the check holds every worktree to
    git(host, "worktree", "add", "-q", "-b", "test/worktree", tree)
    const inTree = launch(join(programOf(host), "naima.ts"), tree, "check")
    assert.equal(inTree.code, 0, inTree.err)
    assert.deepEqual(onDisk(programOf(tree)), [COPY_FILE, ...shipped].sort(), "the second worktree's program is naima/ too")
    renameSync(`${source}.away`, source)

    // Main moves the runtime and the tracker; update follows main and copies naima/ again.
    const readme = join(source, RUNTIME_DIR, "docs", "README.md")
    writeFileSync(readme, readFileSync(readme, "utf8") + "\nMoved.\n")
    writeFileSync(join(source, "naima-tracker", "naima-data", "note.txt"), "a tracker change\n")
    git(source, "add", "-A")
    git(source, "commit", "-q", "-m", "docs and tracker moved")
    const moved = git(source, "rev-parse", "main")
    const asked = naima(host, "update", "--check")
    assert.equal(asked.code, 1, asked.err)
    assert.match(asked.out, /the source's main moved/)
    const up = naima(host, "update")
    assert.equal(up.code, 0, up.err)
    assert.equal(JSON.parse(readFileSync(join(programOf(host), COPY_FILE), "utf8")).commit, moved)
    assert.match(readFileSync(join(programOf(host), "docs", "README.md"), "utf8"), /Moved\.\n$/)
    assert.deepEqual(onDisk(programOf(host)), [COPY_FILE, ...shipped].sort(), "after the update, the program is naima/ exactly")
    assert.match(naima(host, "update", "--check").out, /current: the source's main is the locked commit/)
  } finally {
    removeTemp(base)
  }
})
