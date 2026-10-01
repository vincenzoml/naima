import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { vendor } from "./program.ts"
import { writeFileAtomic, writeJson } from "./internal.ts"
import { gitIn } from "./testing.ts"

test("a write replaces the file whole: new content lands beside it, then is renamed over it", () => {
  const dir = mkdtempSync(join(tmpdir(), "naima-atomic-"))
  try {
    const path = join(dir, "meta.json")
    writeJson(path, { v: 1 })
    const before = statSync(path).ino
    writeJson(path, { v: 2 })
    assert.notEqual(statSync(path).ino, before, "the old file is replaced by a new one, never truncated and rewritten in place")
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { v: 2 })
    writeFileAtomic(join(dir, "note.md"), "text\n")
    assert.deepEqual(readdirSync(dir).sort(), ["meta.json", "note.md"], "no temporary file is left behind")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a vendored update that fails to check out leaves the previous program in place", () => {
  const base = mkdtempSync(join(tmpdir(), "naima-vendor-"))
  const saved = process.env["GIT_INDEX_FILE"]
  try {
    const source = join(base, "source")
    mkdirSync(source)
    gitIn(source, "init", "-q", "-b", "main")
    writeFileSync(join(source, "naima.ts"), "v1\n")
    gitIn(source, "add", "-A")
    gitIn(source, "commit", "-q", "-m", "v1")
    writeFileSync(join(source, "naima.ts"), "v2\n")
    gitIn(source, "commit", "-q", "-am", "v2")
    const next = gitIn(source, "rev-parse", "HEAD")
    const root = join(base, "host")
    const tracker = join(root, "naima-tracker")
    const program = join(tracker, "naima")
    mkdirSync(program, { recursive: true })
    gitIn(root, "init", "-q", "-b", "main")
    writeFileSync(join(program, "naima.ts"), "v1\n")
    const t = { root, tracker, program, source, commit: "0".repeat(40), carry: "vendored" as const }

    process.env["GIT_INDEX_FILE"] = join(base, "no", "such", "dir", "index") // the checkout cannot write its index
    assert.throws(() => vendor(t, next))
    assert.equal(readFileSync(join(program, "naima.ts"), "utf8"), "v1\n", "the program that ran before is still there")
    delete process.env["GIT_INDEX_FILE"]
    vendor(t, next)
    assert.equal(readFileSync(join(program, "naima.ts"), "utf8"), "v2\n")
    assert.deepEqual(readdirSync(tracker).sort(), ["naima"], "nothing is left beside it")
    assert.ok(existsSync(program))
  } finally {
    if (saved === undefined) delete process.env["GIT_INDEX_FILE"]
    else process.env["GIT_INDEX_FILE"] = saved
    rmSync(base, { recursive: true, force: true })
  }
})
