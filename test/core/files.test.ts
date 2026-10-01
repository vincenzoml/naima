import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { copyProgram } from "../../naima/src/core/program.ts"
import { writeFileAtomic, writeJson } from "../../naima/src/core/internal.ts"
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

test("a copy that cannot be made leaves the previous program in place, and nothing beside it", () => {
  const base = mkdtempSync(join(tmpdir(), "naima-copy-"))
  try {
    const source = join(base, "source")
    mkdirSync(join(source, "naima", "src"), { recursive: true })
    gitIn(source, "init", "-q", "-b", "main")
    writeFileSync(join(source, "naima", "naima.ts"), "v1\n")
    writeFileSync(join(source, "naima", "src", "cli.ts"), "v1\n")
    writeFileSync(join(source, "README.md"), "not runtime\n")
    gitIn(source, "add", "-A")
    gitIn(source, "commit", "-q", "-m", "v1")
    const first = gitIn(source, "rev-parse", "HEAD")
    gitIn(source, "rm", "-q", "-r", "naima")
    gitIn(source, "commit", "-q", "-m", "no runtime folder")
    const broken = gitIn(source, "rev-parse", "HEAD")
    const root = join(base, "host")
    const tracker = join(root, "naima-tracker")
    const program = join(tracker, "naima")
    mkdirSync(tracker, { recursive: true })
    gitIn(root, "init", "-q", "-b", "main")
    const t = { root, tracker, program, source, commit: first, carry: "vendored" as const, cache: join(base, "cache") }

    copyProgram(t)
    assert.equal(readFileSync(join(program, "naima.ts"), "utf8"), "v1\n")
    assert.ok(!existsSync(join(program, "README.md")), "only naima/ is copied")
    assert.throws(() => copyProgram({ ...t, commit: broken }), /holds no naima\/ folder/)
    assert.equal(readFileSync(join(program, "naima.ts"), "utf8"), "v1\n", "the program that ran before is still there")
    assert.deepEqual(readdirSync(tracker).sort(), ["naima"], "nothing is left beside it")
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
