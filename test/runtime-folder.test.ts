// The runtime folder, naima/: what the product holds at its top, and a
// project's program is a git clone of. It holds only what runs Naima, and is
// whole on its own — every import and every link resolves inside it; and a
// project whose program is a clone of the product gets exactly naima/'s files,
// through its first run, check, new, guide, a new worktree and an update, end
// to end through the launcher (docs/guide/install.md).

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, posix } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { GUIDE_PAGES } from "../naima/src/core/cli.ts"
import { RUNTIME_DIR } from "../naima/src/core/internal.ts"
import { gitIn as git, productRepo, removeTemp, trackedFiles } from "./core/testing.ts"

/** This checkout. */
const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const tracked = trackedFiles(REPO)
/** The runtime files, by their path in naima/: what the product holds. */
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
  for (const f of shipped) for (const dev of DEV_ONLY) assert.ok(!dev.test(f), `${f} is in the product, and it is development-only (${dev})`)
  for (const f of ["naima.ts", "src/cli.ts", "src/launcher.ts", "README.md", "LICENSE", "NOTICE", ...GUIDE_PAGES.map(([, p]) => p)]) {
    assert.ok(inCopy.has(f), `${f} must be in the product`)
  }
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

/** The files on disk under `dir`, with forward slashes, but git's own. */
function onDisk(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (rel === ".git") return []
    return e.isDirectory() ? onDisk(dir, rel) : [rel]
  }).sort()
}

/** A host project, its program a git clone of `source`. */
function hostOf(base: string, source: string, name = "project"): string {
  const host = join(base, name)
  mkdirSync(host)
  writeFileSync(join(host, "README.md"), "# A project\n")
  git(host, "init", "-q", "-b", "main")
  git(host, "add", "-A")
  git(host, "commit", "-q", "-m", "init")
  git(host, "clone", "-q", "--", source, "naima-tracker/naima")
  return host
}

const env = { ...process.env, NO_COLOR: "1", NAIMA_DATA: undefined, NAIMA_LAUNCHED: undefined }
const programOf = (host: string) => join(host, "naima-tracker", "naima")
const naima = (host: string, ...args: string[]) => {
  const r = spawnSync("deno", ["run", "-A", join(programOf(host), "naima.ts"), ...args], { cwd: host, encoding: "utf8", env })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}

test("a project's program holds exactly naima/'s files, and its first run, check, new, guide, a new worktree and update all work on it", {
  skip: !hasDeno && "deno is not on PATH",
  timeout: 60_000, // many git and Deno subprocesses: past Bun's 5 second default (bugs/bun-s-5-second-default-test-timeout)
}, () => {
  const base = mkdtempSync(join(tmpdir(), "naima-runtime-"))
  try {
    const source = productRepo(join(base, "naima")).dir
    const host = hostOf(base, source)
    const runtime = git(source, "ls-tree", "-r", "--name-only", "HEAD").split("\n").sort()
    assert.deepEqual(runtime, shipped, "the product's files are this checkout's naima/")

    const first = naima(host, "check")
    assert.equal(first.code, 0, first.out + first.err)
    const main = git(source, "rev-parse", "main")
    assert.equal(JSON.parse(readFileSync(join(host, "naima-tracker", "naima-data", "naima.json"), "utf8")).commit, main, "the lock names main's commit")
    assert.deepEqual(onDisk(programOf(host)), shipped, "the program directory is naima/: 0 tests, 0 items, no agent rules")
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

    // A new worktree, with the source gone: its program is a local clone of the main worktree's.
    renameSync(source, `${source}.away`)
    const tree = `${host}-worktrees/worktree` // by the naming scheme the check holds every worktree to
    git(host, "worktree", "add", "-q", "-b", "test/worktree", tree)
    git(host, "clone", "-q", "--local", "--", programOf(host), programOf(tree))
    git(programOf(tree), "remote", "set-url", "origin", source)
    const inTree = naima(tree, "check")
    assert.equal(inTree.code, 0, inTree.err)
    assert.deepEqual(onDisk(programOf(tree)), shipped, "the second worktree's program is naima/'s files too")
    renameSync(`${source}.away`, source)

    // Main moves the runtime; update follows main and checks it out.
    const readme = join(source, "docs", "README.md")
    writeFileSync(readme, readFileSync(readme, "utf8") + "\nMoved.\n")
    git(source, "add", "-A")
    git(source, "commit", "-q", "-m", "docs moved")
    const moved = git(source, "rev-parse", "main")
    const asked = naima(host, "update", "--check")
    assert.equal(asked.code, 1, asked.err)
    assert.match(asked.out, /the source's main moved/)
    const up = naima(host, "update")
    assert.equal(up.code, 0, up.err)
    assert.equal(git(programOf(host), "rev-parse", "HEAD"), moved)
    assert.match(readFileSync(join(programOf(host), "docs", "README.md"), "utf8"), /Moved\.\n$/)
    assert.deepEqual(onDisk(programOf(host)), shipped, "after the update, the program is naima/'s files exactly")
    assert.match(naima(host, "update", "--check").out, /current: the source's main is the locked commit/)
  } finally {
    removeTemp(base)
  }
})

// ---- host leakage: what an installed program directory holds, read off the disk ----

/** The paths under `dir` that only developing Naima needs: tests, fixtures, CI, agent rules, tracker items. */
function leaks(dir: string): string[] {
  const all = onDisk(dir)
  const item = (f: string) => /(^|\/)naima-data\/.+\/meta\.json$/.test(f) || /^naima-tracker\//.test(f)
  const devOnly = (f: string) =>
    /\.test\.ts$/.test(f) || /(^|\/)testing\.ts$/.test(f) || /^test\//.test(f) || /(^|\/)(AGENTS|CLAUDE)\.md$/.test(f) ||
    /(^|\/)\.(claude|github)\//.test(f)
  return all.filter((f) => item(f) || devOnly(f))
}

test("host leakage: an installed program holds no test, no tracker item and no agent rule, though the old layout in its history held them", {
  skip: !hasDeno && "deno is not on PATH",
  timeout: 60_000, // git and Deno subprocesses: past Bun's 5 second default
}, () => {
  const base = mkdtempSync(join(tmpdir(), "naima-leak-"))
  try {
    const product = productRepo(join(base, "naima"), { oldLayout: true })
    // The negative half: the old layout held Naima's development rules beside naima/, so there is something to leak.
    assert.ok(git(product.dir, "ls-tree", "-r", "--name-only", product.old!).split("\n").includes("AGENTS.md"))
    const host = hostOf(base, product.dir)
    const filed = naima(host, "new", "tests", "The host's own test")
    assert.equal(filed.code, 0, filed.err)

    const program = programOf(host)
    assert.deepEqual(leaks(program), [], "the program directory holds nothing that only developing Naima needs")
    assert.deepEqual(onDisk(program), shipped, "it is exactly naima/'s files")
    assert.equal(git(program, "status", "--porcelain", "--ignored"), "", "a clean clone: nothing written into it")

    // The host's own material lives in its own naima-data/, never in the program directory.
    const data = join(host, "naima-tracker", "naima-data")
    assert.ok(onDisk(data).some((f) => /^tests\/.+\/meta\.json$/.test(f)), "the host's item is under its naima-data/tests/")
  } finally {
    removeTemp(base)
  }
})
