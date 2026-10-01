// The entry point, in process, on every runtime: a git repository somewhere
// on disk, Naima's CLI run against it as the development build runs, without
// the launcher. What only the launcher does — aligning the program, updating,
// carrying, and the permissions — is in distribution.test.ts.

import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { firstParty } from "./builtins.ts"
import { GUIDE_PAGES } from "./core/cli.ts"
import { gitIn, removeTemp } from "./core/testing.ts"
import { ABOUT, FORMAT, runCli, TRACKER_README } from "./core/internal.ts"

const NAIMA = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * The Naima that runs init: a clone of this repository, as a project's
 * naima-tracker/naima/ is. Not the working tree itself, which has work its
 * origin lacks, and init refuses to lock that. Its origin holds its HEAD, as
 * a pushed clone's does, whatever this checkout's branches are.
 */
const PROGRAM = (() => {
  const dir = join(mkdtempSync(join(tmpdir(), "naima-program-")), "naima")
  gitIn(NAIMA, "clone", "-q", "--", NAIMA, dir)
  gitIn(dir, "update-ref", "refs/remotes/origin/pushed", "HEAD")
  process.on("exit", () => rmSync(dirname(dir), { recursive: true, force: true }))
  return dir
})()

/** A git repository outside Naima, with one commit. */
function host() {
  const base = mkdtempSync(join(tmpdir(), "naima-host-"))
  const root = join(base, "project")
  mkdirSync(join(root, "src"), { recursive: true })
  const git = (...args: string[]) => gitIn(root, ...args)
  git("init", "-q", "-b", "main")
  writeFileSync(join(root, "README.md"), "# A project that is not Naima\n")
  writeFileSync(join(root, "src", "main.py"), "print('hello')\n")
  git("add", "-A")
  git("-c", "user.email=test@example.invalid", "-c", "user.name=test", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "init")
  return { base, root, git, cleanup: () => removeTemp(base) }
}

async function naima(cwd: string, argv: string[], programRoot = PROGRAM) {
  const out: string[] = []
  const err: string[] = []
  const io = { out: (l = "") => void out.push(l), err: (l: string) => void err.push(l), now: () => new Date("2026-01-15T10:00:00Z") }
  const code = await runCli(argv, { cwd, programRoot, firstParty, io })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

test("init writes naima-tracker/ and nothing else, locked to the Naima that runs it; again, it changes nothing", async () => {
  const h = host()
  try {
    const init = await naima(h.root, ["init"])
    assert.equal(init.code, 0, init.err)
    assert.match(init.out, /next: naima new/)
    const data = JSON.parse(readFileSync(join(h.root, "naima-tracker", "naima-data", "naima.json"), "utf8"))
    const git = (...args: string[]) => gitIn(PROGRAM, ...args)
    assert.deepEqual(data, {
      format: FORMAT,
      formats: { gates: 2 },
      source: git("remote", "get-url", "origin"),
      commit: git("rev-parse", "HEAD"),
      carry: "clone",
    })
    assert.equal(readFileSync(join(h.root, "naima-tracker", "README.md"), "utf8"), TRACKER_README)
    assert.equal(readFileSync(join(h.root, "naima-tracker", ".gitignore"), "utf8"), "/naima/\n")
    assert.equal(
      h.git("status", "--porcelain", "--untracked-files=all"),
      ["?? naima-tracker/.gitignore", "?? naima-tracker/README.md", "?? naima-tracker/naima-data/naima.json"].join("\n"),
    )
    assert.equal((await naima(h.root, ["init"])).code, 0)
    assert.equal(h.git("status", "--porcelain", "--untracked-files=all").split("\n").length, 3)
  } finally {
    h.cleanup()
  }
})

test("the tracker's README and Naima's own share one sentence", () => {
  assert.ok(readFileSync(join(NAIMA, "README.md"), "utf8").includes(`Naima ${ABOUT}`))
  assert.equal(TRACKER_README.split("\n").length, 2, "one line")
})

test("init refuses outside a git repository", async () => {
  const dir = mkdtempSync(join(tmpdir(), "naima-nogit-"))
  try {
    const r = await naima(dir, ["init"])
    assert.equal(r.code, 2)
    assert.match(r.err, /not a git repository/)
    assert.deepEqual(readdirSync(dir), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("every first-party plugin is loaded with nothing but the lock; new, link, show, board, from a subdirectory", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    const sub = join(h.root, "src")
    const plugins = (await naima(sub, ["plugins"])).out
    for (const p of firstParty) assert.match(plugins, new RegExp(`\\b${p.name}\\b`))
    const made = await naima(sub, ["new", "bugs", "Export drops alpha", "--set", "impact=high"])
    assert.match(made.out, /^naima-tracker\/naima-data\/bugs\/export-drops-alpha\//)
    assert.equal((await naima(sub, ["new", "tests", "Export keeps alpha"])).code, 0)
    assert.equal((await naima(sub, ["link", "export-keeps-alpha", "verifies", "export-drops-alpha"])).code, 0)
    const shown = await naima(sub, ["show", "export-drops-alpha"])
    assert.match(shown.out, /is proven by tests\/export-keeps-alpha \[open\] {2}\(inverse\)/)
    const check = await naima(sub, ["check"])
    assert.equal(check.code, 0, check.out)
    assert.match((await naima(sub, ["board", "bugs"])).out, /1 open, 0 done/)
    assert.match((await naima(sub, ["unknown"])).err, /unknown command/)
    assert.equal((await naima(sub, ["new", "bugs", "x", "--set", "impact=huge"])).code, 2)
  } finally {
    h.cleanup()
  }
})

test("--data names a data directory that has moved", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    renameSync(join(h.root, "naima-tracker", "naima-data"), join(h.root, "tracking"))
    assert.equal((await naima(h.root, ["check"])).code, 2, "no naima-tracker/naima-data/ any more")
    const r = await naima(h.root, ["--data", "tracking", "new", "todos", "Moved"])
    assert.equal(r.code, 0, r.err)
    assert.match(r.out, /^tracking\/todos\/moved\//)
  } finally {
    h.cleanup()
  }
})

test("newer data is refused in one line, and nothing is written", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    const file = join(h.root, "naima-tracker", "naima-data", "naima.json")
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), format: FORMAT + 1 }))
    const r = await naima(h.root, ["new", "bugs", "x"])
    assert.equal(r.code, 2)
    assert.equal(r.out, "")
    assert.equal(
      r.err,
      `naima: naima.json is format ${
        FORMAT + 1
      }, newer than the format ${FORMAT} this Naima reads — it was written by a newer Naima: record that Naima's commit`,
    )
    assert.ok(!existsSync(join(h.root, "naima-tracker", "naima-data", "bugs")))
  } finally {
    h.cleanup()
  }
})

test("a third-party plugin runs only from inside the program; a first-party name takes replacedBy, never source", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    const program = join(h.base, "fork")
    mkdirSync(join(program, "plugins"), { recursive: true })
    const plugin =
      `export default (o) => ({ name: "hello", says: "demo", commands: [{ name: "hello", says: "", usage: "hello", run: (_a, ctx) => { ctx.out("hello " + o.who); return 0 } }] })\n`
    writeFileSync(join(program, "plugins", "hello.mjs"), plugin)
    writeFileSync(join(h.root, "hello.mjs"), plugin)
    const file = join(h.root, "naima-tracker", "naima-data", "naima.json")
    const lock = JSON.parse(readFileSync(file, "utf8"))
    const plugins = (table: unknown) => writeFileSync(file, JSON.stringify({ ...lock, plugins: table }))
    plugins({ hello: { source: "plugins/hello.mjs", options: { who: "world" } } })
    assert.equal((await naima(h.root, ["hello"], program)).out, "hello world")
    plugins({ hello: { source: "../project/hello.mjs" } })
    assert.match((await naima(h.root, ["hello"], program)).err, /not a path inside the program/)
    plugins({ trackers: { source: "plugins/hello.mjs" } })
    assert.match(
      (await naima(h.root, ["check"], program)).err,
      /plugins\.trackers is first-party and already loaded — replacedBy runs other code under its name/,
    )
    plugins({ hello: { options: {} } })
    assert.match((await naima(h.root, ["check"], program)).err, /plugins\.hello is no first-party plugin and names no source/)
  } finally {
    h.cleanup()
  }
})

test("update and carry move the program, so they run only through the launcher; guide points at files that exist", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    for (const command of ["update", "carry"]) assert.match((await naima(h.root, [command])).err, /runs through the launcher/)
    const guide = await naima(NAIMA, ["guide"])
    assert.equal(guide.code, 0)
    const paths = [...guide.out.matchAll(/^ {2}\S+\s+(\S+)$/gm)].map((m) => m[1] as string)
    assert.equal(paths.length, GUIDE_PAGES.length)
    for (const p of paths) assert.ok(existsSync(join(NAIMA, p)), p)
    assert.doesNotMatch(guide.out, /AGENTS\.md/, "Naima's own development rules are not a host's documentation")
  } finally {
    h.cleanup()
  }
})

test("the reference is the program's: a project's own gates do not change it", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    const before = await naima(h.root, ["docs"])
    const file = join(h.root, "naima-tracker", "naima-data", "naima.json")
    const lock = JSON.parse(readFileSync(file, "utf8"))
    writeFileSync(
      file,
      JSON.stringify({ ...lock, plugins: { gates: { options: { gates: { "v1-launch": { title: "The launch", says: "what ships first" } } } } } }),
    )
    const after = await naima(h.root, ["docs"])
    assert.equal(after.code, 0, after.err)
    assert.equal(after.out, before.out)
    assert.doesNotMatch(after.out, /v1-launch|The launch/)
    assert.match((await naima(h.root, ["gates"])).out, /v1-launch — The launch: HOLDS/)
  } finally {
    h.cleanup()
  }
})

test("exit codes tell a usage error (2) from an internal one (70), and a command's own 75 is not a request to relaunch", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    const program = join(h.base, "fork")
    mkdirSync(join(program, "plugins"), { recursive: true })
    writeFileSync(
      join(program, "plugins", "codes.mjs"),
      `let runs = 0
export default () => ({ name: "codes", says: "exit codes", commands: [
  { name: "seventy-five", says: "x", usage: "seventy-five", examples: ["seventy-five"], run: (_a, ctx) => { runs++; ctx.out("run " + runs); return 75 } },
  { name: "bug", says: "x", usage: "bug", examples: ["bug"], run: () => { const o = undefined; return o.missing } },
] })\n`,
    )
    const file = join(h.root, "naima-tracker", "naima-data", "naima.json")
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), plugins: { codes: { source: "plugins/codes.mjs" } } }))
    const own = await naima(h.root, ["seventy-five"], program)
    assert.deepEqual([own.code, own.out], [1, "run 1"])
    assert.match(own.err, /exited 75, the code reserved for asking the launcher to relaunch — reported as 1/)
    const bug = await naima(h.root, ["bug"], program)
    assert.equal(bug.code, 70)
    assert.match(bug.err, /^naima: internal error: TypeError: .*NAIMA_DEBUG=1/)
    const usage = await naima(h.root, ["show"], program)
    assert.deepEqual([usage.code, usage.err], [2, "naima: usage: naima show <item>"])
  } finally {
    h.cleanup()
  }
})

test("list, unlink, view, types and help each do what their usage says", async () => {
  const h = host()
  try {
    assert.equal((await naima(h.root, ["init"])).code, 0)
    await naima(h.root, ["new", "bugs", "Export drops alpha", "--set", "impact=high"])
    await naima(h.root, ["new", "todos", "Write the release notes"])
    await naima(h.root, ["set", "write-release-notes", "status=done"])
    await naima(h.root, ["link", "export-drops-alpha", "blocked-by", "write-release-notes"])

    const all = await naima(h.root, ["list"])
    assert.match(all.out, /open\s+Export drops alpha {2}— bugs\/export-drops-alpha\n.*done\s+Write the release notes.*\n2 items$/)
    assert.equal((await naima(h.root, ["list", "bugs", "--open"])).out.split("\n").at(-1), "1 item")
    assert.equal((await naima(h.root, ["list", "nope"])).code, 2)

    assert.match(
      (await naima(h.root, ["unlink", "export-drops-alpha", "blocked-by", "write-release-notes"])).out,
      /^removed bugs\/export-drops-alpha blocked-by todos\/write-release-notes$/,
    )
    assert.doesNotMatch((await naima(h.root, ["show", "export-drops-alpha"])).out, /waits on/)
    const again = await naima(h.root, ["unlink", "export-drops-alpha", "blocked-by", "write-release-notes"])
    assert.deepEqual([again.code, again.err], [2, 'naima: bugs/export-drops-alpha stores no "blocked-by" link to todos/write-release-notes'])

    assert.match((await naima(h.root, ["view"])).out, /^ {2}next {13}open items, most urgent first$/m)
    assert.match((await naima(h.root, ["view", "next", "1"])).out, /high .*bugs\/export-drops-alpha/)
    assert.match((await naima(h.root, ["view", "nope"])).err, /no view "nope" — views: next/)

    const types = (await naima(h.root, ["types"])).out
    assert.match(types, /^bugs \(naima-tracker\/naima-data\/bugs\/\) — something that is broken$/m)
    assert.match(types, /^ {2}passed {5}done, proves — /m)

    const help = (await naima(h.root, ["help"])).out
    for (const name of ["init", "update", "new", "list", "claim", "triage", "verify", "docs"]) assert.match(help, new RegExp(`^  ${name} `, "m"))
    assert.doesNotMatch(help, /^ {2}help /m)
    assert.equal((await naima(h.root, ["--help"])).out, help)
  } finally {
    h.cleanup()
  }
})
