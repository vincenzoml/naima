// The distribution, end to end, under Deno and through the launcher, whatever
// runtime runs this file: a Naima source repository, a host project whose
// naima-tracker/naima/ is a copy of the source's naima/, and every way the
// program is copied, updated, carried and fenced in. docs/guide/install.md and
// docs/reference/format.md describe what is asserted here.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { COPY_FILE, FORMAT, TRACKER_README } from "../naima/src/core/internal.ts"
import { gitIn as git, removeTemp } from "./core/testing.ts"

/** The runtime folder of this checkout: what a program directory holds a copy of. */
const NAIMA = join(dirname(dirname(fileURLToPath(import.meta.url))), "naima")

if (spawnSync("deno", ["--version"]).status !== 0) throw new Error("deno is not on PATH: these tests run Naima through its launcher, under Deno")

// bugs/bun-s-5-second-default-test-timeout: these tests clone the whole checkout and run
// several `naima` invocations through the launcher — slow enough, under load, to graze Bun's
// 5 second per-test default. Node's test runner honors the same option; Deno's test shim
// ignores it.
const SLOW = { timeout: 30_000 }

/** A world on disk: Naima's source as a git repository, its runtime in naima/, a host project, and the user's cache. */
function world() {
  const base = mkdtempSync(join(tmpdir(), "naima-dist-"))
  const source = join(base, "naima")
  mkdirSync(join(source, "naima"), { recursive: true })
  cpSync(join(NAIMA, "src"), join(source, "naima", "src"), { recursive: true })
  cpSync(join(NAIMA, "naima.ts"), join(source, "naima", "naima.ts"))
  writeFileSync(join(source, "AGENTS.md"), "Naima's own development rules: never copied.\n")
  git(source, "init", "-q", "-b", "main")
  git(source, "add", "-A")
  git(source, "commit", "-q", "-m", "Naima")
  const host = join(base, "project")
  mkdirSync(join(host, "src"), { recursive: true })
  writeFileSync(join(host, "README.md"), "# A project that is not Naima\n")
  git(host, "init", "-q", "-b", "main")
  git(host, "add", "-A")
  git(host, "commit", "-q", "-m", "init")
  return {
    base,
    source,
    host,
    cache: join(base, "cache"),
    head: (repo = source) => git(repo, "rev-parse", "HEAD"),
    /** A new commit on the source's main, changing `file` (under naima/) by `edit`. */
    advance(file = "src/marker.txt", edit: (text: string) => string = (t) => t + "moved\n") {
      const path = join(source, "naima", file)
      writeFileSync(path, edit(existsSync(path) ? readFileSync(path, "utf8") : ""))
      git(source, "add", "-A")
      git(source, "commit", "-q", "-m", `change ${file}`)
      return git(source, "rev-parse", "HEAD")
    },
    cleanup: () => removeTemp(base),
  }
}

/** The user's cache in a world: NAIMA_CACHE, so no test reads or writes the machine's own. */
let cacheOf = ""

/** Naima through a launcher: any Naima's, run from inside the project; `extraEnv` added to the environment. */
function launch(launcher: string, cwd: string, ...args: string[]) {
  return launchWith({}, launcher, cwd, ...args)
}

function launchWith(extraEnv: Record<string, string>, launcher: string, cwd: string, ...args: string[]) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    NO_COLOR: "1",
    NAIMA_DATA: undefined,
    NAIMA_LAUNCHED: undefined,
    NAIMA_CACHE: cacheOf,
    ...extraEnv,
  }
  const r = spawnSync("deno", ["run", "-A", launcher, ...args], { cwd, encoding: "utf8", env })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}

/** Naima as a person or an agent runs it: the project's own launcher. */
const naima = (cwd: string, ...args: string[]) => launch(join(git(cwd, "rev-parse", "--show-toplevel"), "naima-tracker", "naima", "naima.ts"), cwd, ...args)

/** The install, as the installer does it: a clone of the source outside the project runs init, which copies naima/ into the program. */
function bootstrap(w: ReturnType<typeof world>) {
  cacheOf = w.cache
  const clone = join(w.base, "installer")
  rmSync(clone, { recursive: true, force: true })
  git(w.base, "clone", "-q", "--", w.source, clone)
  const init = launch(join(clone, "naima", "naima.ts"), w.host, "init")
  assert.equal(init.code, 0, init.err)
  rmSync(clone, { recursive: true, force: true })
  return init
}

const lockOf = (host: string) => JSON.parse(readFileSync(join(host, "naima-tracker", "naima-data", "naima.json"), "utf8"))
const setLock = (host: string, patch: Record<string, unknown>) =>
  writeFileSync(join(host, "naima-tracker", "naima-data", "naima.json"), JSON.stringify({ ...lockOf(host), ...patch }, null, 2) + "\n")
const programOf = (host: string) => join(host, "naima-tracker", "naima")
/** The commit a program directory is a copy of. */
const copied = (host: string): string => JSON.parse(readFileSync(join(programOf(host), COPY_FILE), "utf8")).commit
/** Whether the user's cache holds `commit`. */
const cached = (w: ReturnType<typeof world>, commit: string): boolean =>
  existsSync(w.cache) && readdirSync(w.cache).some((repo) => spawnSync("git", ["-C", join(w.cache, repo), "cat-file", "-e", `${commit}^{commit}`]).status === 0)

test("bootstrap, init, new, check: the only addition is naima-tracker/, and git sees naima-data/, README.md and .gitignore but not naima/", () => {
  const w = world()
  try {
    bootstrap(w)
    assert.deepEqual(lockOf(w.host), { format: FORMAT, formats: { gates: 2 }, source: w.source, commit: w.head() }, "carry left out: the gitignored copy")
    assert.ok(!existsSync(join(programOf(w.host), ".git")), "the program is plain files")
    assert.ok(!existsSync(join(programOf(w.host), "AGENTS.md")) && existsSync(join(programOf(w.host), "naima.ts")), "naima/ only")
    assert.equal(copied(w.host), w.head())
    assert.equal(readFileSync(join(w.host, "naima-tracker", "README.md"), "utf8"), TRACKER_README)
    const made = naima(join(w.host, "src"), "new", "bugs", "Export drops alpha")
    assert.equal(made.code, 0, made.err)
    const check = naima(join(w.host, "src"), "check")
    assert.equal(check.code, 0, check.out + check.err)
    assert.equal(
      git(w.host, "status", "--porcelain", "--untracked-files=all"),
      [
        "?? naima-tracker/.gitignore",
        "?? naima-tracker/README.md",
        "?? naima-tracker/naima-data/bugs/export-drops-alpha/README.md",
        "?? naima-tracker/naima-data/bugs/export-drops-alpha/attachments/.gitkeep",
        "?? naima-tracker/naima-data/bugs/export-drops-alpha/meta.json",
        "?? naima-tracker/naima-data/naima.json",
      ].join("\n"),
    )
    assert.match(git(w.host, "status", "--porcelain", "--ignored"), /^!! naima-tracker\/naima\/$/m)
    assert.equal(readFileSync(join(w.host, "README.md"), "utf8"), "# A project that is not Naima\n", "no project file is touched")
  } finally {
    w.cleanup()
  }
})

test("a second clone of the host, a new worktree and another project copy the locked commit from the user's cache, with the source gone", SLOW, () => {
  const w = world()
  try {
    bootstrap(w)
    const locked = w.head()
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    w.advance() // the source's main is no longer the lock
    renameSync(w.source, `${w.source}.gone`) // no source: every copy below comes from the cache

    const second = join(w.base, "second")
    git(w.base, "clone", "-q", w.host, second)
    assert.ok(!existsSync(programOf(second)), "the program is not in the host's history")
    const r = launch(join(programOf(w.host), "naima.ts"), second, "check") // any Naima at hand aligns this checkout's own
    assert.equal(r.code, 0, r.err)
    assert.equal(copied(second), locked)

    const tree = `${w.host}-worktrees/worktree` // by the naming scheme the check holds every worktree to
    git(w.host, "worktree", "add", "-q", "-b", "test/worktree", tree)
    const inTree = launch(join(programOf(w.host), "naima.ts"), tree, "check")
    assert.equal(inTree.code, 0, inTree.err)
    assert.equal(copied(tree), locked)

    const other = join(w.base, "other")
    mkdirSync(other)
    git(other, "init", "-q", "-b", "main")
    mkdirSync(join(other, "naima-tracker", "naima-data"), { recursive: true })
    writeFileSync(
      join(other, "naima-tracker", "naima-data", "naima.json"),
      JSON.stringify({ format: FORMAT, formats: { gates: 2 }, source: w.source, commit: locked }),
    )
    const elsewhere = launch(join(programOf(w.host), "naima.ts"), other, "check")
    assert.equal(elsewhere.code, 0, elsewhere.err)
    assert.equal(copied(other), locked, "the cache is the user's: shared by every project")
  } finally {
    w.cleanup()
  }
})

test("naima update pulls, migrates and records the new commit; a normal run never pulls", SLOW, () => {
  const w = world()
  try {
    bootstrap(w)
    const old = w.head()
    assert.equal(naima(w.host, "new", "todos", "Written in the old format").code, 0)
    // The source's main gains a migration: format FORMAT → FORMAT + 1 stamps every item.
    const moved = w.advance("src/core/migrations.ts", (t) =>
      t.replace(
        "export const CORE_MIGRATIONS: readonly Migration[] = [pluginsTable]",
        `export const CORE_MIGRATIONS: readonly Migration[] = [pluginsTable, { from: ${FORMAT}, says: "stamped", item: (m) => ({ ...m, stamped: true }), stale: (m) => m.stamped !== true }]`,
      ))

    const check = naima(w.host, "check")
    assert.equal(check.code, 0, check.err)
    assert.equal(copied(w.host), old, "a normal run keeps the lock")
    assert.ok(!cached(w, moved), "and fetched nothing")
    assert.equal(lockOf(w.host).commit, old)

    const asked = naima(w.host, "update", "--check")
    assert.equal(asked.code, 1)
    assert.match(asked.out, /the source's main moved/)

    const up = naima(w.host, "update")
    assert.equal(up.code, 0, up.err)
    assert.match(up.out, new RegExp(`locked ${old.slice(0, 12)} → ${moved.slice(0, 12)}`))
    assert.match(up.out, new RegExp(`migrated the data from format ${FORMAT} to ${FORMAT + 1}`))
    assert.deepEqual({ format: lockOf(w.host).format, commit: lockOf(w.host).commit }, { format: FORMAT + 1, commit: moved })
    assert.equal(copied(w.host), moved)
    const meta = JSON.parse(readFileSync(join(w.host, "naima-tracker", "naima-data", "todos", "written-old-format", "meta.json"), "utf8"))
    assert.equal(meta.stamped, true)
    assert.equal(naima(w.host, "check").code, 0)
    assert.equal(naima(w.host, "update", "--check").code, 0)
    assert.match(naima(w.host, "update").out, /nothing to migrate/, "again: a no-op")
  } finally {
    w.cleanup()
  }
})

test("alignment refuses rather than destroy or guess: changed files, an unreachable commit, no network on the first run", () => {
  const w = world()
  try {
    bootstrap(w)
    writeFileSync(join(programOf(w.host), "src", "marker.txt"), "my change\n")
    setLock(w.host, { commit: w.advance() })
    const dirty = naima(w.host, "check")
    assert.equal(dirty.code, 2)
    assert.equal(
      dirty.err,
      "naima: naima-tracker/naima has changes to its files — publish them as a fork and set source in naima.json; Naima never overwrites them",
    )
    assert.equal(readFileSync(join(programOf(w.host), "src", "marker.txt"), "utf8"), "my change\n")
    rmSync(join(programOf(w.host), "src", "marker.txt"))

    setLock(w.host, { commit: "0123456789abcdef0123456789abcdef01234567" })
    const lost = naima(w.host, "check")
    assert.equal(lost.code, 2)
    assert.equal(
      lost.err,
      `naima: commit 0123456789ab cannot be fetched from ${w.source} — its history was rewritten or the source is gone; record a commit it has`,
    )

    setLock(w.host, { commit: "1".repeat(40), source: join(w.base, "nowhere") })
    rmSync(programOf(w.host), { recursive: true, force: true })
    const offline = launch(join(NAIMA, "naima.ts"), w.host, "check")
    assert.equal(offline.code, 2)
    assert.equal(offline.err.split("\n").length, 1, offline.err)
    assert.match(offline.err, /^naima: cannot fetch from .*nowhere: .* — a commit is copied from the network the first time this machine runs it$/)
  } finally {
    w.cleanup()
  }
})

/** A fork of Naima with a plugin that tries to reach outside the tracker folder. */
function fork(w: ReturnType<typeof world>) {
  const dir = join(w.base, "fork")
  git(w.base, "clone", "-q", w.source, dir)
  mkdirSync(join(dir, "naima", "plugins"))
  writeFileSync(
    join(dir, "naima", "plugins", "escape.ts"),
    `import { writeFileSync } from "node:fs"
import { join } from "node:path"
const command = (name: string, run: (ctx: { root: string; trackerRoot: string; out(l: string): void }) => void) => ({ name, says: name, usage: name, examples: [name], run: (_a: string[], ctx: any) => (run(ctx), 0) })
export default () => ({
  name: "escape",
  says: "tries to reach outside",
  commands: [
    command("fork-says", (ctx) => ctx.out("this is the fork")),
    command("write-inside", (ctx) => writeFileSync(join(ctx.trackerRoot, "inside.txt"), "ok")),
    command("write-outside", (ctx) => writeFileSync(join(ctx.root, "escaped.txt"), "no")),
    command("run-other", () => { new Deno.Command("ls").outputSync() }),
  ],
})
`,
  )
  writeFileSync(
    join(dir, "naima", "plugins", "tool.ts"),
    `export default () => ({
  name: "tool",
  says: "a verifier that starts an external program",
  verifiers: [{
    id: "echoes",
    says: "holds when echo, an external program, prints the property back",
    runs: ["echo"],
    verify: async ({ property }: { property: string }) => {
      const out = new TextDecoder().decode(new Deno.Command("echo", { args: [property] }).outputSync().stdout).trim()
      return { verdict: out === property ? "holds" : "error", output: out }
    },
  }],
})
`,
  )
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", "A fork with a plugin")
  return { dir, commit: git(dir, "rev-parse", "HEAD") }
}

/** Accept the source naima.json now names, as whoever changed it must: naima update --accept-source. */
function accept(host: string) {
  const r = naima(host, "update", "--accept-source")
  assert.equal(r.code, 0, r.err)
  return r
}

test("a fork source is honoured once accepted: the whole project runs that fork at that commit", () => {
  const w = world()
  try {
    bootstrap(w)
    const f = fork(w)
    setLock(w.host, { source: f.dir, commit: f.commit, plugins: { escape: { source: "plugins/escape.ts" } } })
    const refused = naima(w.host, "fork-says")
    assert.equal(refused.code, 2)
    assert.match(refused.err, /^naima: the lock's source changed: .*\/naima → .*\/fork, locked commit moved \w{12} → \w{12} — .*naima update --accept-source$/)
    assert.equal(JSON.parse(readFileSync(join(programOf(w.host), COPY_FILE), "utf8")).source, w.source, "refused: the program is still the source's")
    const check = naima(w.host, "update", "--check")
    assert.equal(check.code, 0, `update --check only reads the source, so it still answers: ${check.err}`)
    assert.match(accept(w.host).out, /^trusted .*\/fork at the locked commit \w{12}; nothing else moved$/m)
    const r = naima(w.host, "fork-says")
    assert.equal(r.code, 0, r.err)
    assert.equal(r.out, "this is the fork")
    assert.equal(copied(w.host), f.commit)
    assert.equal(JSON.parse(readFileSync(join(programOf(w.host), COPY_FILE), "utf8")).source, f.dir)
  } finally {
    w.cleanup()
  }
})

test("under the launcher's permissions Naima writes only under naima-tracker/ and runs only git: Deno refuses the rest", () => {
  const w = world()
  try {
    bootstrap(w)
    const f = fork(w)
    setLock(w.host, { source: f.dir, commit: f.commit, plugins: { escape: { source: "plugins/escape.ts" } } })
    accept(w.host)
    assert.equal(naima(w.host, "write-inside").code, 0)
    assert.ok(existsSync(join(w.host, "naima-tracker", "naima-data", "inside.txt")))
    const write = naima(w.host, "write-outside")
    assert.equal(write.code, 2)
    assert.match(write.err, /^naima: Requires write access to ".*project\/escaped\.txt", run again with the --allow-write flag$/)
    assert.ok(!existsSync(join(w.host, "escaped.txt")))
    const run = naima(w.host, "run-other")
    assert.equal(run.code, 2)
    assert.equal(run.err, 'naima: Requires run access to "ls", run again with the --allow-run flag')
  } finally {
    w.cleanup()
  }
})

test("a pulled lock that moves the commit on the same source is followed, and says so", () => {
  const w = world()
  try {
    bootstrap(w)
    const before = lockOf(w.host).commit
    const after = w.advance()
    setLock(w.host, { commit: after }) // a teammate's naima update, merged
    const r = naima(w.host, "check")
    assert.equal(r.code, 0, r.err)
    assert.equal(r.err, `naima: locked commit moved ${before.slice(0, 12)} → ${after.slice(0, 12)}`)
    assert.equal(copied(w.host), after)
  } finally {
    w.cleanup()
  }
})

test('verify: "signed" runs a locked commit only when git verifies its signature', () => {
  const w = world()
  try {
    bootstrap(w)
    const key = join(w.base, "signer")
    spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "signer", "-f", key])
    const signers = join(w.base, "allowed_signers")
    writeFileSync(signers, `test@example.invalid ${readFileSync(`${key}.pub`, "utf8")}`)
    const trust = { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "gpg.ssh.allowedSignersFile", GIT_CONFIG_VALUE_0: signers }
    const run = (...args: string[]) => launchWith(trust, join(programOf(w.host), "naima.ts"), w.host, ...args)

    const unsigned = w.advance()
    setLock(w.host, { commit: unsigned, verify: "signed" })
    const refused = run("check")
    assert.equal(refused.code, 2)
    assert.match(refused.err, /^naima: commit \w{12} of .* carries no signature git can verify .* verify: "signed"/)
    assert.notEqual(copied(w.host), unsigned, "refused: the program stays where it was")

    writeFileSync(join(w.source, "naima", "src", "marker.txt"), "signed\n")
    git(w.source, "add", "-A")
    git(w.source, "-c", "gpg.format=ssh", "-c", `user.signingkey=${key}`, "commit", "-q", "-S", "-m", "signed")
    const signed = w.head()
    setLock(w.host, { commit: signed })
    const ok = run("check")
    assert.equal(ok.code, 0, ok.err)
    assert.equal(copied(w.host), signed)
  } finally {
    w.cleanup()
  }
})

test("a verifier's declared programs, and only they, are allowed besides git", () => {
  const w = world()
  try {
    bootstrap(w)
    const f = fork(w)
    setLock(w.host, { source: f.dir, commit: f.commit, plugins: { tool: { source: "plugins/tool.ts" }, escape: { source: "plugins/escape.ts" } } })
    accept(w.host)
    assert.equal(naima(w.host, "runs", "--json").out, '["echo"]')
    writeFileSync(join(w.host, "model.txt"), "anything\n")
    assert.equal(naima(w.host, "new", "properties", "Echo answers", "--set", "verifier=echoes", "--set", "model=model.txt", "--set", "property=hello").code, 0)
    const v = naima(w.host, "verify", "echo-answers")
    assert.equal(v.code, 0, v.out + v.err)
    assert.match(v.out, /^holds/)
    const other = naima(w.host, "run-other")
    assert.equal(other.err, 'naima: Requires run access to "ls", run again with the --allow-run flag', "a program nobody declared is still refused")
  } finally {
    w.cleanup()
  }
})

test("under the launcher, the trunk reads another worktree's uncommitted claim from its disk", () => {
  const w = world()
  try {
    bootstrap(w)
    assert.equal(naima(w.host, "new", "bugs", "Alpha").code, 0)
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    const wt = join(w.base, "wt")
    git(w.host, "worktree", "add", "-q", "-b", "fix/alpha", wt)
    const claim = launch(join(programOf(w.host), "naima.ts"), wt, "claim", "alpha")
    assert.equal(claim.code, 0, claim.err)
    const claims = naima(w.host, "claims")
    assert.equal(claims.code, 0, claims.err)
    assert.match(claims.out, /^fix\/alpha\n {2}bugs\/alpha {2}Alpha$/m, "not committed on fix/alpha, and seen from the trunk")
  } finally {
    w.cleanup()
  }
})

test("naima carry round-trips copy → vendored → submodule → copy, the checks passing and the same commit running in each mode", SLOW, () => {
  const w = world()
  try {
    bootstrap(w)
    const locked = w.head()
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    const cli = readFileSync(join(programOf(w.host), "src", "cli.ts"), "utf8")
    let at = "."
    const step = (mode: string, runtime: string) => {
      const r = launch(join(programOf(w.host), at, "naima.ts"), w.host, "carry", mode)
      at = runtime
      assert.equal(r.code, 0, r.err)
      assert.match(r.out, new RegExp(`carried as ${mode}.*staged`))
      git(w.host, "commit", "-q", "-m", `Carry Naima as ${mode}`)
      assert.equal(git(w.host, "status", "--porcelain"), "", `${mode}: the switch is one commit`)
      // A submodule is the whole commit: its launcher is the one in its naima/.
      const check = launch(join(programOf(w.host), runtime, "naima.ts"), w.host, "check")
      assert.equal(check.code, 0, `${mode}: ${check.out}${check.err}`)
      assert.equal(lockOf(w.host).carry, mode === "copy" ? undefined : mode, "the default is recorded by leaving carry out")
      assert.equal(lockOf(w.host).commit, locked)
      assert.equal(readFileSync(join(programOf(w.host), runtime, "src", "cli.ts"), "utf8"), cli, `${mode}: the locked commit's code`)
    }

    step("vendored", ".")
    assert.ok(!existsSync(join(programOf(w.host), ".git")))
    assert.ok(git(w.host, "ls-files", "naima-tracker/naima/naima.ts"), "the program is committed")
    assert.ok(git(w.host, "ls-files", `naima-tracker/naima/${COPY_FILE}`), "with what it is a copy of")
    assert.ok(!existsSync(join(w.host, "naima-tracker", ".gitignore")))

    step("submodule", "naima")
    assert.match(git(w.host, "ls-files", "--stage", "naima-tracker/naima"), new RegExp(`^160000 ${locked} 0\\tnaima-tracker/naima$`))
    assert.match(readFileSync(join(w.host, ".gitmodules"), "utf8"), /path = naima-tracker\/naima/)
    assert.equal(git(programOf(w.host), "rev-parse", "HEAD"), locked)

    step("copy", ".")
    assert.equal(git(w.host, "ls-files", "naima-tracker/naima"), "")
    assert.ok(!existsSync(join(w.host, ".gitmodules")))
    assert.ok(!existsSync(join(programOf(w.host), ".git")) && !existsSync(join(programOf(w.host), "AGENTS.md")), "a copy of naima/ again")
    assert.equal(readFileSync(join(w.host, "naima-tracker", ".gitignore"), "utf8"), "/naima/\n")
    assert.equal(copied(w.host), locked)
  } finally {
    w.cleanup()
  }
})

/** A dist commit of `main`, as the branch projects once cloned held: naima/'s tree at the top, its main commit in a trailer. */
function distOf(source: string, main: string, parent?: string): string {
  const tree = git(source, "rev-parse", `${main}:naima`)
  const message = `dist of ${main.slice(0, 12)}\n\nSource-Commit: ${main}\n`
  const commit = spawnSync("git", ["-C", source, "commit-tree", tree, ...(parent ? ["-p", parent] : []), "-F", "-"], {
    input: message,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  }).stdout.trim()
  git(source, "update-ref", "refs/heads/dist", commit)
  return commit
}

test("a project locked to a dist commit keeps running its clone; naima update moves it to main, by its Source-Commit trailer, as a copy", SLOW, () => {
  const w = world()
  try {
    cacheOf = w.cache
    const main = w.head()
    const dist = distOf(w.source, main)
    git(w.host, "clone", "-q", "--branch", "dist", "--", w.source, "naima-tracker/naima") // the install as it was
    mkdirSync(join(w.host, "naima-tracker", "naima-data"))
    writeFileSync(join(w.host, "naima-tracker", ".gitignore"), "/naima/\n")
    writeFileSync(
      join(w.host, "naima-tracker", "naima-data", "naima.json"),
      JSON.stringify({ format: FORMAT, formats: { gates: 2 }, source: w.source, commit: dist, carry: "clone" }),
    )
    const before = naima(w.host, "check")
    assert.equal(before.code, 0, before.err)
    assert.equal(git(programOf(w.host), "rev-parse", "HEAD"), dist, "still the clone of the dist commit")

    // A new worktree of it, with no program yet: the dist commit is cloned there too, not copied.
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    const tree = `${w.host}-worktrees/dist`
    git(w.host, "worktree", "add", "-q", "-b", "test/dist", tree)
    const inTree = launch(join(programOf(w.host), "naima.ts"), tree, "check")
    assert.equal(inTree.code, 0, inTree.err)
    assert.equal(git(programOf(tree), "rev-parse", "HEAD"), dist)

    const asked = naima(w.host, "update", "--check")
    assert.equal(asked.code, 1, asked.err)
    assert.match(
      asked.out,
      new RegExp(`the lock names ${dist.slice(0, 12)} \\(the dist of ${main.slice(0, 12)}\\), the code of the source's main as a dist commit`),
    )
    const up = naima(w.host, "update")
    assert.equal(up.code, 0, up.err)
    assert.match(up.out, new RegExp(`locked ${dist.slice(0, 12)} \\(the dist of ${main.slice(0, 12)}\\) → ${main.slice(0, 12)}`))
    assert.deepEqual(lockOf(w.host), { format: FORMAT, formats: { gates: 2 }, source: w.source, commit: main }, "a commit of main, and carry left out")
    assert.ok(!existsSync(join(programOf(w.host), ".git")), "the clone became a copy")
    assert.equal(copied(w.host), main)
    assert.equal(naima(w.host, "check").code, 0)
  } finally {
    w.cleanup()
  }
})

test("a clone of a main commit in the program directory, as an install once made, becomes a copy on the next run, unless it holds work", () => {
  const w = world()
  try {
    cacheOf = w.cache
    git(w.host, "clone", "-q", "--", w.source, "naima-tracker/naima")
    mkdirSync(join(w.host, "naima-tracker", "naima-data"))
    writeFileSync(
      join(w.host, "naima-tracker", "naima-data", "naima.json"),
      JSON.stringify({ format: FORMAT, formats: { gates: 2 }, source: w.source, commit: w.head() }),
    )
    writeFileSync(join(programOf(w.host), "naima", "src", "mine.txt"), "work\n")
    const launcher = join(programOf(w.host), "naima", "naima.ts")
    const refused = launch(launcher, w.host, "check")
    assert.equal(refused.code, 2)
    assert.match(refused.err, /naima-tracker\/naima has uncommitted changes/)
    rmSync(join(programOf(w.host), "naima", "src", "mine.txt"))
    const r = launch(launcher, w.host, "check")
    assert.equal(r.code, 0, r.err)
    assert.ok(!existsSync(join(programOf(w.host), ".git")) && !existsSync(join(programOf(w.host), "AGENTS.md")))
    assert.equal(copied(w.host), w.head())
  } finally {
    w.cleanup()
  }
})
