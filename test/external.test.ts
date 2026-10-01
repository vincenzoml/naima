// Plugins from outside the program, pinned: a file of the project by its
// sha256, a module of a git repository by commit. Each says the contract it
// is written for, and receives the plugin API from its factory, so it imports
// nothing of the core.

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { firstParty } from "../naima/src/builtins.ts"
import { CONTRACT, FORMAT, runCli } from "../naima/src/core/internal.ts"
import { gitIn, removeTemp } from "./core/testing.ts"

/** A plugin that imports nothing: every core function it calls comes from the API its factory is handed. */
const PLUGIN = (contract: number, greeting = "open") =>
  `export default (options, api) => ({
  name: "external",
  says: "a plugin from outside the program",
  contract: ${contract},
  commands: [{
    name: "count-open",
    says: "count the open items",
    usage: "count-open",
    examples: ["count-open"],
    run: (_args, ctx) => { ctx.out(api.plugin + ": " + ctx.repo.items.filter((i) => api.isOpen(ctx, i)).length + " ${greeting}" + (options.suffix ?? "")); return 0 },
  }],
})
`

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex")

function project() {
  const base = mkdtempSync(join(tmpdir(), "naima-external-"))
  const root = join(base, "project")
  const tracker = join(root, "naima-tracker")
  const data = join(tracker, "naima-data")
  mkdirSync(data, { recursive: true })
  gitIn(root, "init", "-q", "-b", "main")
  const lock = { format: FORMAT, formats: { gates: 2 }, source: "https://example.invalid/naima.git", commit: "0".repeat(40) }
  const configure = (plugins: Record<string, unknown>) => writeFileSync(join(data, "naima.json"), JSON.stringify({ ...lock, plugins }))
  const run = async (...argv: string[]) => {
    const out: string[] = []
    const err: string[] = []
    const io = { out: (l = "") => void out.push(l), err: (l: string) => void err.push(l), now: () => new Date("2026-01-15T10:00:00Z") }
    const code = await runCli(argv, { cwd: root, programRoot: join(base, "program"), firstParty, io })
    return { code, out: out.join("\n"), err: err.join("\n") }
  }
  return { base, root, tracker, configure, run, cleanup: () => removeTemp(base) }
}

test("a file of the project runs as a plugin when its sha256 is the one pinned, and is refused the moment it changes", async () => {
  const p = project()
  try {
    mkdirSync(join(p.root, "tools"))
    const text = PLUGIN(CONTRACT)
    writeFileSync(join(p.root, "tools", "external.mjs"), text)
    p.configure({ counter: { source: { path: "tools/external.mjs", sha256: sha256(text) }, options: { suffix: "!" } } })
    await p.run("new", "bugs", "One")
    const r = await p.run("count-open")
    assert.equal(r.code, 0, r.err)
    assert.equal(r.out, "counter: 1 open!", "the API it is handed says its name as the project gives it")

    writeFileSync(join(p.root, "tools", "external.mjs"), PLUGIN(CONTRACT, "OPEN"))
    const changed = await p.run("count-open")
    assert.equal(changed.code, 2)
    assert.match(
      changed.err,
      new RegExp(`tools/external\\.mjs has changed since it was pinned: its sha256 is ${sha256(PLUGIN(CONTRACT, "OPEN"))}, not ${sha256(text)}`),
    )
    p.configure({ counter: { source: { path: "../outside.mjs", sha256: sha256(text) } } })
    assert.match((await p.run("check")).err, /\.\.\/outside\.mjs is not a path inside the project/)
  } finally {
    p.cleanup()
  }
})

test("a module of a git repository runs pinned by commit, fetched once into the tracker folder, which git ignores", async () => {
  const p = project()
  const repo = join(p.base, "plugin-repo")
  try {
    mkdirSync(repo)
    gitIn(repo, "init", "-q", "-b", "main")
    writeFileSync(join(repo, "index.mjs"), PLUGIN(CONTRACT, "first"))
    gitIn(repo, "add", "-A")
    gitIn(repo, "commit", "-q", "-m", "first")
    const first = gitIn(repo, "rev-parse", "HEAD")
    writeFileSync(join(repo, "index.mjs"), PLUGIN(CONTRACT, "second"))
    gitIn(repo, "commit", "-q", "-am", "second")
    const second = gitIn(repo, "rev-parse", "HEAD")

    p.configure({ counter: { source: { git: repo, commit: first, path: "index.mjs" } } })
    const r = await p.run("count-open")
    assert.equal(r.code, 0, r.err)
    assert.equal(r.out, "counter: 0 first", "the pinned commit, not the repository's head")
    assert.ok(existsSync(join(p.tracker, "plugins", "counter", "index.mjs")))
    assert.match(readFileSync(join(p.tracker, ".gitignore"), "utf8"), /^\/plugins\/$/m)

    p.configure({ counter: { source: { git: repo, commit: second, path: "index.mjs" } } })
    // A module once imported stays in the runtime's cache: the pin is proven on disk, where the next run reads it.
    assert.equal((await p.run("check")).code, 0)
    assert.match(readFileSync(join(p.tracker, "plugins", "counter", "index.mjs"), "utf8"), /second/)

    writeFileSync(join(p.tracker, "plugins", "counter", "index.mjs"), "export default () => ({ name: 'x', says: 'tampered' })\n")
    assert.match((await p.run("check")).err, /has local changes — what runs must be the pinned commit/)
    p.configure({ counter: { source: { git: repo, commit: "f".repeat(40), path: "index.mjs" } } })
    assert.match((await p.run("check")).err, /has no commit f{40}/)
    p.configure({ counter: { source: { git: repo, commit: "abc", path: "index.mjs" } } })
    assert.match((await p.run("check")).err, /commit must be the full hash/)
  } finally {
    p.cleanup()
  }
})

test("a plugin says the contract it is written for: a newer one is refused, one that says none is read as contract 1", async () => {
  const p = project()
  try {
    mkdirSync(join(p.root, "tools"))
    const newer = PLUGIN(CONTRACT + 1)
    writeFileSync(join(p.root, "tools", "newer.mjs"), newer)
    p.configure({ newer: { source: { path: "tools/newer.mjs", sha256: sha256(newer) } } })
    assert.match(
      (await p.run("check")).err,
      new RegExp(`plugin "newer" is written for contract ${CONTRACT + 1}, and this Naima speaks ${CONTRACT} — update Naima to run it`),
    )
    const legacy = PLUGIN(CONTRACT).replace(`contract: ${CONTRACT},\n`, "")
    writeFileSync(join(p.root, "tools", "legacy.mjs"), legacy)
    p.configure({ legacy: { source: { path: "tools/legacy.mjs", sha256: sha256(legacy) } } })
    assert.equal((await p.run("count-open")).out, "legacy: 0 open")
  } finally {
    p.cleanup()
  }
})
