// scripts/coverage.ts: a run's coverage of a copy of this source is counted for the file it copies.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { original, remap } from "../scripts/coverage.ts"
import { removeTemp } from "./core/testing.ts"

test("coverage of a copied source is mapped to the file it is an identical copy of, and nothing else", () => {
  const base = mkdtempSync(join(tmpdir(), "naima-cov-"))
  try {
    const root = join(base, "repo")
    const copy = join(base, "project", "naima-tracker", "naima")
    for (const dir of [join(root, "src", "core"), join(copy, "src", "core")]) mkdirSync(dir, { recursive: true })
    writeFileSync(join(root, "src", "core", "program.ts"), "export const x = 1\n")
    writeFileSync(join(copy, "src", "core", "program.ts"), "export const x = 1\n")
    writeFileSync(join(root, "src", "core", "format.ts"), "export const FORMAT = 1\n")
    writeFileSync(join(copy, "src", "core", "format.ts"), "export const FORMAT = 2\n") // edited on purpose by a test
    const url = (p: string) => pathToFileURL(p).href
    assert.equal(original(url(join(copy, "src", "core", "program.ts")), root), join(root, "src", "core", "program.ts"))
    assert.equal(original(url(join(copy, "src", "core", "format.ts")), root), null)
    assert.equal(original(url(join(root, "src", "core", "program.ts")), root), null, "already this repository's")

    const raw = join(base, "raw")
    mkdirSync(raw)
    const record = (name: string, path: string) => writeFileSync(join(raw, name), JSON.stringify({ scriptId: "1", url: url(path), functions: [] }))
    record("a.json", join(copy, "src", "core", "program.ts"))
    record("b.json", join(copy, "src", "core", "format.ts"))
    record("c.json", join(root, "src", "core", "program.ts"))
    assert.deepEqual(remap(raw, root), { mapped: 1, dropped: 1 })
    assert.deepEqual(readdirSync(raw).sort(), ["a.json", "c.json"])
    assert.equal(JSON.parse(readFileSync(join(raw, "a.json"), "utf8")).url, url(join(root, "src", "core", "program.ts")))
  } finally {
    removeTemp(base)
  }
})
