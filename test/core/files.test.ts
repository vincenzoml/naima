import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { writeFileAtomic, writeJson } from "../../naima/src/core/internal.ts"

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
