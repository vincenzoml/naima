// The distribution, end to end, under Deno and through the launcher, whatever
// runtime runs this file: the product as a git repository, a host project
// whose naima-tracker/naima/ is a git clone of it locked by commit, and every
// way the program is installed, aligned, updated, migrated and fenced in.
// docs/guide/install.md and docs/reference/format.md describe what is
// asserted here.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { FORMAT, trackerReadme } from "../naima/src/core/internal.ts"
import { gitIn as git, productRepo, removeTemp } from "./core/testing.ts"

if (spawnSync("deno", ["--version"]).status !== 0) throw new Error("deno is not on PATH: these tests run Naima through its launcher, under Deno")

// bugs/bun-s-5-second-default-test-timeout: these tests build the product and run several
// `naima` invocations through the launcher — slow enough, under load, to graze Bun's 5 second
// per-test default. Node's test runner honors the same option; Deno's test shim ignores it.
const SLOW = { timeout: 60_000 }

/** A world on disk: the product as a git repository (`oldLayout`: with a commit of the old layout first), and a host project. */
function world(opts: { oldLayout?: boolean } = {}) {
  const base = mkdtempSync(join(tmpdir(), "naima-dist-"))
  const source = join(base, "naima")
  const product = productRepo(source, opts)
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
    old: product.old,
    head: (repo = source) => git(repo, "rev-parse", "HEAD"),
    /** A new commit on the product's main, changing `file` by `edit`. */
    advance(file = "src/marker.txt", edit: (text: string) => string = (t) => t + "moved\n") {
      const path = join(source, file)
      writeFileSync(path, edit(existsSync(path) ? readFileSync(path, "utf8") : ""))
      git(source, "add", "-A")
      git(source, "commit", "-q", "-m", `change ${file}`)
      return git(source, "rev-parse", "HEAD")
    },
    cleanup: () => removeTemp(base),
  }
}

/** Naima through a launcher, run from `cwd`; `extraEnv` added to the environment. */
function launchWith(extraEnv: Record<string, string>, launcher: string, cwd: string, ...args: string[]) {
  const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: "1", NAIMA_DATA: undefined, NAIMA_LAUNCHED: undefined, ...extraEnv }
  const r = spawnSync("deno", ["run", "-A", launcher, ...args], { cwd, encoding: "utf8", env })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}
const launch = (launcher: string, cwd: string, ...args: string[]) => launchWith({}, launcher, cwd, ...args)

const programOf = (host: string) => join(host, "naima-tracker", "naima")
/** Naima as a person or an agent runs it: the project's own program. */
const naima = (host: string, ...args: string[]) => launch(join(programOf(host), "naima.ts"), host, ...args)

/** The install: a git clone of the product into naima-tracker/naima, and any command, which makes the data beside it. */
function install(w: ReturnType<typeof world>) {
  git(w.host, "clone", "-q", "--", w.source, "naima-tracker/naima")
  const first = naima(w.host, "check")
  assert.equal(first.code, 0, first.out + first.err)
  return first
}

const lockOf = (host: string) => JSON.parse(readFileSync(join(host, "naima-tracker", "naima-data", "naima.json"), "utf8"))
const setLock = (host: string, patch: Record<string, unknown>) =>
  writeFileSync(join(host, "naima-tracker", "naima-data", "naima.json"), JSON.stringify({ ...lockOf(host), ...patch }, null, 2) + "\n")
/** The commit the program is checked out at. */
const at = (host: string): string => git(programOf(host), "rev-parse", "HEAD")

test("a git clone of the product and one command install it: naima-data/, README.md and .gitignore beside the program, and nothing else", SLOW, () => {
  const w = world()
  try {
    const first = install(w)
    assert.match(first.err, /^naima: wrote naima-tracker\/: README\.md, \.gitignore, naima-data\/naima\.json — locked to .* at \w{12}$/m)
    assert.deepEqual(lockOf(w.host), { format: FORMAT, formats: { gates: 2 }, source: w.source, commit: w.head() })
    assert.equal(readFileSync(join(w.host, "naima-tracker", "README.md"), "utf8"), trackerReadme("naima-tracker", w.source))
    assert.match(readFileSync(join(w.host, "naima-tracker", "README.md"), "utf8"), new RegExp(`git clone ${w.source} naima-tracker/naima\n`))
    assert.equal(readFileSync(join(w.host, "naima-tracker", ".gitignore"), "utf8"), "/naima/\n")
    assert.equal(at(w.host), w.head())
    const made = naima(w.host, "new", "bugs", "Export drops alpha")
    assert.equal(made.code, 0, made.err)
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
    assert.equal(git(programOf(w.host), "status", "--porcelain"), "", "the program clone stays clean")
    assert.equal(readFileSync(join(w.host, "README.md"), "utf8"), "# A project that is not Naima\n", "no project file is touched")
  } finally {
    w.cleanup()
  }
})

test("outside a git repository, the first run refuses with the installer's message and writes nothing", SLOW, () => {
  const w = world()
  try {
    const bare = join(w.base, "bare")
    git(w.base, "clone", "-q", "--", w.source, join(bare, "naima"))
    const r = launchWith({ GIT_CEILING_DIRECTORIES: w.base }, join(bare, "naima", "naima.ts"), bare, "check")
    assert.equal(r.code, 2)
    assert.match(r.err, /is not in a git repository\. Is its folder the root of your project\?/)
    assert.ok(!existsSync(join(bare, "naima-data")))
  } finally {
    w.cleanup()
  }
})

test("a second clone of the host, and a worktree, align their program to the lock with the source gone", SLOW, () => {
  const w = world()
  try {
    const older = w.head()
    const locked = w.advance()
    install(w)
    assert.equal(lockOf(w.host).commit, locked)
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    git(w.source, "tag", "older", older)
    // A shallow clone of the program at the older commit, made while the source was there: it does not hold the lock.
    const tree = `${w.host}-worktrees/worktree` // by the naming scheme the check holds every worktree to
    git(w.host, "worktree", "add", "-q", "-b", "test/worktree", tree)
    git(w.base, "clone", "-q", "--depth", "1", "--branch", "older", "--", `file://${w.source}`, programOf(tree))
    git(programOf(tree), "remote", "set-url", "origin", w.source)
    git(programOf(tree), "update-ref", "refs/remotes/origin/main", "HEAD") // as a clone of main at that time would have it
    assert.notEqual(at(tree), locked)
    renameSync(w.source, `${w.source}.gone`) // no source: what aligns below comes from this disk

    const second = join(w.base, "second")
    git(w.base, "clone", "-q", w.host, second)
    assert.ok(!existsSync(programOf(second)), "the program is not in the host's history")
    git(w.base, "clone", "-q", "--", programOf(w.host), programOf(second))
    git(programOf(second), "remote", "set-url", "origin", w.source)
    git(programOf(second), "checkout", "-q", "--detach", older)
    const r = naima(second, "check")
    assert.equal(r.code, 0, r.err)
    assert.equal(r.err.split("\n")[0], `naima: locked commit moved ${older.slice(0, 12)} → ${locked.slice(0, 12)}`)
    assert.equal(at(second), locked)

    const inTree = naima(tree, "check")
    assert.equal(inTree.code, 0, inTree.err)
    assert.equal(at(tree), locked, "fetched from the main worktree's program")
  } finally {
    w.cleanup()
  }
})

test("naima update fetches main, checks it out, migrates and records the commit, as one change; a normal run never pulls", SLOW, () => {
  const w = world()
  try {
    install(w)
    const old = w.head()
    assert.equal(naima(w.host, "new", "todos", "Written in the old format").code, 0)
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    // The product's main gains a migration: format FORMAT → FORMAT + 1 stamps every item.
    const moved = w.advance("src/core/migrations.ts", (t) =>
      t.replace(
        "export const CORE_MIGRATIONS: readonly Migration[] = [pluginsTable, dropCarry]",
        `export const CORE_MIGRATIONS: readonly Migration[] = [pluginsTable, dropCarry, { from: ${FORMAT}, says: "stamped", item: (m) => ({ ...m, stamped: true }), stale: (m) => m.stamped !== true }]`,
      ))

    const check = naima(w.host, "check")
    assert.equal(check.code, 0, check.err)
    assert.equal(at(w.host), old, "a normal run keeps the lock")
    assert.ok(spawnSync("git", ["-C", programOf(w.host), "cat-file", "-e", `${moved}^{commit}`]).status !== 0, "and fetched nothing")

    const asked = naima(w.host, "update", "--check")
    assert.equal(asked.code, 1)
    assert.match(asked.out, /the source's main moved/)

    const up = naima(w.host, "update")
    assert.equal(up.code, 0, up.err)
    assert.match(up.out, new RegExp(`locked ${old.slice(0, 12)} → ${moved.slice(0, 12)}`))
    assert.match(up.out, new RegExp(`migrated the data from format ${FORMAT} to ${FORMAT + 1}`))
    assert.deepEqual({ format: lockOf(w.host).format, commit: lockOf(w.host).commit }, { format: FORMAT + 1, commit: moved })
    assert.equal(at(w.host), moved)
    const meta = JSON.parse(readFileSync(join(w.host, "naima-tracker", "naima-data", "todos", "written-old-format", "meta.json"), "utf8"))
    assert.equal(meta.stamped, true)
    git(w.host, "add", "naima-tracker")
    git(w.host, "commit", "-q", "-m", "Update Naima")
    assert.equal(git(w.host, "status", "--porcelain"), "", "the update is one commit")
    assert.equal(naima(w.host, "check").code, 0)
    assert.equal(naima(w.host, "update", "--check").code, 0)
    assert.match(naima(w.host, "update").out, /nothing to migrate/, "again: a no-op")
  } finally {
    w.cleanup()
  }
})

test("a lock of the old layout, or of a copy, migrates: refused by every command but update, which moves it to the product's head", SLOW, () => {
  const w = world({ oldLayout: true })
  try {
    install(w)
    const head = w.head()
    // A host installed before the split: its lock names a commit of the old layout, with carry and format 2.
    setLock(w.host, { format: 2, commit: w.old, carry: "copy" })
    const refused = naima(w.host, "check")
    assert.equal(refused.code, 2)
    assert.equal(
      refused.err,
      `naima: commit ${w.old!.slice(0, 12)} is of Naima's old layout, its program in naima/: naima update moves the lock to the head of the source's main`,
    )
    const up = naima(w.host, "update")
    assert.equal(up.code, 0, up.out + up.err)
    assert.match(up.out, /migrated the data from format 2 to 3/)
    assert.deepEqual(lockOf(w.host), { format: FORMAT, formats: { gates: 2 }, source: w.source, commit: head }, "carry left naima.json")
    assert.equal(at(w.host), head)

    // A program committed in the project is removed by hand: update says how, in one line.
    setLock(w.host, { format: 2, carry: "vendored" })
    const vendored = naima(w.host, "update")
    assert.equal(vendored.code, 2)
    assert.equal(vendored.err.split("\n").length, 1, vendored.err)
    assert.match(vendored.err, /carry: "vendored".* remove it by hand: git rm -r -q --cached naima-tracker\/naima/)
    setLock(w.host, { format: FORMAT, carry: undefined })

    // A copy, as the program was before it was a clone: moved aside by the installer, never overwritten.
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    const copy = join(w.base, "copy")
    git(w.base, "clone", "-q", w.host, copy)
    mkdirSync(programOf(copy), { recursive: true })
    writeFileSync(join(programOf(copy), ".naima-copy.json"), "{}\n")
    const viaHost = launch(join(programOf(w.host), "naima.ts"), copy, "--data", join(copy, "naima-tracker", "naima-data"), "check")
    assert.equal(viaHost.code, 2)
    assert.match(viaHost.err, /naima-tracker\/naima is a copy of Naima from before the program was a git clone — move it aside and run the installer again/)
  } finally {
    w.cleanup()
  }
})

test("alignment refuses rather than destroy or guess: uncommitted changes, an unreachable commit", SLOW, () => {
  const w = world()
  try {
    install(w)
    writeFileSync(join(programOf(w.host), "src", "marker.txt"), "my change\n")
    setLock(w.host, { commit: w.advance() })
    const dirty = naima(w.host, "check")
    assert.equal(dirty.code, 2)
    assert.equal(
      dirty.err,
      "naima: naima-tracker/naima has uncommitted changes — publish them as a fork and set source in naima.json; Naima never overwrites them",
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
  } finally {
    w.cleanup()
  }
})

/** A fork of the product with a plugin that tries to reach outside the tracker folder. */
function fork(w: ReturnType<typeof world>) {
  const dir = join(w.base, "fork")
  git(w.base, "clone", "-q", w.source, dir)
  mkdirSync(join(dir, "plugins"))
  writeFileSync(
    join(dir, "plugins", "escape.ts"),
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
    join(dir, "plugins", "tool.ts"),
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

test("a fork source is honoured once accepted: the whole project runs that fork at that commit", SLOW, () => {
  const w = world()
  try {
    install(w)
    const f = fork(w)
    setLock(w.host, { source: f.dir, commit: f.commit, plugins: { escape: { source: "plugins/escape.ts" } } })
    const refused = naima(w.host, "fork-says")
    assert.equal(refused.code, 2)
    assert.match(refused.err, /^naima: the lock's source changed: .*\/naima → .*\/fork, locked commit moved \w{12} → \w{12} — .*naima update --accept-source$/)
    assert.equal(git(programOf(w.host), "remote", "get-url", "origin"), w.source, "refused: the program is still the source's")
    const check = naima(w.host, "update", "--check")
    assert.equal(check.code, 0, `update --check only reads the source, so it still answers: ${check.err}`)
    assert.match(accept(w.host).out, /^trusted .*\/fork at the locked commit \w{12}; nothing else moved$/m)
    const r = naima(w.host, "fork-says")
    assert.equal(r.code, 0, r.err)
    assert.equal(r.out, "this is the fork")
    assert.equal(at(w.host), f.commit)
    assert.equal(git(programOf(w.host), "remote", "get-url", "origin"), f.dir)
  } finally {
    w.cleanup()
  }
})

test("under the launcher's permissions Naima writes only under naima-tracker/ and runs only git: Deno refuses the rest", SLOW, () => {
  const w = world()
  try {
    install(w)
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

test("a pulled lock that moves the commit on the same source is followed, and says so", SLOW, () => {
  const w = world()
  try {
    install(w)
    const before = lockOf(w.host).commit
    const after = w.advance()
    setLock(w.host, { commit: after }) // a teammate's naima update, merged
    const r = naima(w.host, "check")
    assert.equal(r.code, 0, r.err)
    assert.equal(r.err, `naima: locked commit moved ${before.slice(0, 12)} → ${after.slice(0, 12)}`)
    assert.equal(at(w.host), after)
  } finally {
    w.cleanup()
  }
})

test('verify: "signed" runs a locked commit only when git verifies its signature', SLOW, () => {
  const w = world()
  try {
    install(w)
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
    assert.notEqual(at(w.host), unsigned, "refused: the program stays where it was")

    writeFileSync(join(w.source, "src", "marker.txt"), "signed\n")
    git(w.source, "add", "-A")
    git(w.source, "-c", "gpg.format=ssh", "-c", `user.signingkey=${key}`, "commit", "-q", "-S", "-m", "signed")
    const signed = w.head()
    setLock(w.host, { commit: signed })
    const ok = run("check")
    assert.equal(ok.code, 0, ok.err)
    assert.equal(at(w.host), signed)
  } finally {
    w.cleanup()
  }
})

test("a verifier's declared programs, and only they, are allowed besides git", SLOW, () => {
  const w = world()
  try {
    install(w)
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

test("under the launcher, the trunk reads another worktree's uncommitted claim from its disk", SLOW, () => {
  const w = world()
  try {
    install(w)
    assert.equal(naima(w.host, "new", "bugs", "Alpha").code, 0)
    git(w.host, "add", "-A")
    git(w.host, "commit", "-q", "-m", "Track with Naima")
    const wt = `${w.host}-worktrees/alpha`
    git(w.host, "worktree", "add", "-q", "-b", "fix/alpha", wt)
    git(w.base, "clone", "-q", "--local", "--", programOf(w.host), programOf(wt))
    git(programOf(wt), "remote", "set-url", "origin", w.source)
    const claim = naima(wt, "claim", "alpha")
    assert.equal(claim.code, 0, claim.err)
    const claims = naima(w.host, "claims")
    assert.equal(claims.code, 0, claims.err)
    assert.match(claims.out, /^fix\/alpha\n {2}bugs\/alpha {2}Alpha$/m, "not committed on fix/alpha, and seen from the trunk")
  } finally {
    w.cleanup()
  }
})
