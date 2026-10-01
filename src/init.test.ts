// naima init, in process: what it refuses to lock, what it prints as the
// next step, and the lines that keep the program out of the host's own tools
// (docs/install.md#the-hosts-own-tools). Run as the development build, like
// cli.test.ts; the launcher's side of --write-excludes is in launcher.test.ts.

import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { firstParty } from "./builtins.ts"
import { type Plugin, runCli } from "./core/internal.ts"
import { gitIn as git, removeTemp } from "./core/testing.ts"

const NAIMA = dirname(dirname(fileURLToPath(import.meta.url)))

/** A host project, and a Naima cloned into its naima-tracker/naima/ whose origin holds its HEAD. */
function world() {
  const base = mkdtempSync(join(tmpdir(), "naima-init-"))
  const root = join(base, "project")
  mkdirSync(root)
  writeFileSync(join(root, "README.md"), "# A project\n")
  git(root, "init", "-q", "-b", "main")
  git(root, "add", "-A")
  git(root, "commit", "-q", "-m", "init")
  const program = join(root, "naima-tracker", "naima")
  git(base, "clone", "-q", "--", NAIMA, program)
  git(program, "update-ref", "refs/remotes/origin/pushed", "HEAD")
  return { base, root, program, cleanup: () => removeTemp(base) }
}

async function naima(cwd: string, argv: string[], programRoot: string, plugins: typeof firstParty = firstParty) {
  const out: string[] = []
  const err: string[] = []
  const io = { out: (l = "") => void out.push(l), err: (l: string) => void err.push(l), now: () => new Date("2026-01-15T10:00:00Z") }
  const code = await runCli(argv, { cwd, programRoot, firstParty: plugins, io })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

const lockFile = (root: string) => join(root, "naima-tracker", "naima-data", "naima.json")

test("init refuses to lock a commit its origin lacks, or a Naima with uncommitted changes: nobody else could run it", async () => {
  const w = world()
  try {
    writeFileSync(join(w.program, "NOTICE"), "changed\n")
    const dirty = await naima(w.root, ["init"], w.program)
    assert.equal(dirty.code, 2)
    assert.match(dirty.err, /has uncommitted changes, so nobody else could run the commit it would lock/)
    git(w.program, "commit", "-q", "-am", "unpushed")
    git(w.program, "update-ref", "-d", "refs/remotes/origin/pushed")
    const unpushed = await naima(w.root, ["init"], w.program)
    assert.equal(unpushed.code, 2)
    assert.match(unpushed.err, /has commits its source does not have/)
    assert.ok(!existsSync(join(w.root, "naima-tracker", "naima-data")), "nothing is written")
    git(w.program, "update-ref", "refs/remotes/origin/pushed", "HEAD") // pushed: now it may
    assert.equal((await naima(w.root, ["init"], w.program)).code, 0)
  } finally {
    w.cleanup()
  }
})

test("init strips the credentials from an origin URL before it writes the lock", async () => {
  const w = world()
  try {
    git(w.program, "remote", "set-url", "origin", "https://someone:ghp_secret@example.invalid/naima.git")
    const r = await naima(w.root, ["init"], w.program)
    assert.equal(r.code, 0, r.err)
    const text = readFileSync(lockFile(w.root), "utf8")
    assert.doesNotMatch(text, /ghp_secret|someone/)
    assert.equal(JSON.parse(text).source, "https://example.invalid/naima.git")
    assert.doesNotMatch(r.out, /ghp_secret/)
  } finally {
    w.cleanup()
  }
})

test("init's next step names a type the loaded plugins really create, not a hard-coded one", async () => {
  const w = world()
  try {
    const tasks: Plugin = {
      name: "tasks",
      says: "a project whose only type is tasks",
      types: [{ id: "tasks", dir: "tasks", title: "Tasks", says: "work", statuses: { open: { open: true, says: "to do" } }, initialStatus: "open" }],
    } as unknown as Plugin
    const r = await naima(w.root, ["init"], w.program, [{ name: "tasks", factory: () => tasks }])
    assert.equal(r.code, 0, r.err)
    assert.match(r.out, /^next: naima new tasks "<the first thing to do>"$/m)
    assert.doesNotMatch(r.out, /todos/)
    const none = await naima(w.root, ["init"], w.program, [])
    assert.match(none.out, /^next: naima help$/m, "no creatable type: no type is named")
  } finally {
    w.cleanup()
  }
})

test("init prints the exclude line for each host tool configuration it finds, and writes them only with --write-excludes", async () => {
  const w = world()
  try {
    writeFileSync(join(w.root, "deno.json"), JSON.stringify({ tasks: { test: "deno test" } }, null, 2) + "\n")
    writeFileSync(join(w.root, "tsconfig.json"), '{\n  // comments: JSONC, which Naima does not rewrite\n  "compilerOptions": {}\n}\n')
    writeFileSync(join(w.root, ".prettierrc"), "{}\n")
    const before = (f: string) => readFileSync(join(w.root, f), "utf8")
    const deno = before("deno.json")
    const tsconfig = before("tsconfig.json")

    const printed = await naima(w.root, ["init"], w.program)
    assert.equal(printed.code, 0, printed.err)
    assert.match(printed.out, /^exclude from deno\.json: "exclude": \["naima-tracker\/naima\/"\]/m)
    assert.match(printed.out, /^exclude from tsconfig\.json: "exclude": \["node_modules", "naima-tracker\/naima"\]/m)
    assert.match(printed.out, /^exclude from \.prettierignore: naima-tracker\/naima\//m)
    assert.equal(before("deno.json"), deno, "printing touches nothing")
    assert.equal(before("tsconfig.json"), tsconfig)
    assert.ok(!existsSync(join(w.root, ".prettierignore")))

    const written = await naima(w.root, ["init", "--write-excludes"], w.program)
    assert.equal(written.code, 0, written.err)
    assert.deepEqual(JSON.parse(before("deno.json")), { tasks: { test: "deno test" }, exclude: ["naima-tracker/naima/"] })
    assert.equal(before(".prettierignore"), "naima-tracker/naima/\n")
    assert.equal(before("tsconfig.json"), tsconfig, "a file with comments is left to a person")
    assert.match(written.out, /^not written, it is not plain JSON — add by hand to tsconfig\.json/m)

    writeFileSync(join(w.root, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }))
    await naima(w.root, ["init", "--write-excludes"], w.program)
    assert.deepEqual(JSON.parse(before("tsconfig.json")).exclude, ["node_modules", "naima-tracker/naima"], "tsc's default exclusion is kept")
    const again = await naima(w.root, ["init"], w.program)
    assert.doesNotMatch(again.out, /exclude from/, "once there, nothing is printed")
    assert.equal((await naima(w.root, ["init", "--bogus"], w.program)).code, 2)
  } finally {
    w.cleanup()
  }
})
