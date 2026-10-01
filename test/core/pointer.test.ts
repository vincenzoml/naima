// The agent-harness entry-point check's own functions, isolated from a full
// project: what a plain-text path or a markdown link resolves to, and the
// pointer `naima init --write-agent-pointer` writes
// (features/agent-harness-entry-point-check-naima-init).

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { brokenEntryLinks, entryPointers, pointerLine, writePointer } from "../../naima/src/core/pointer.ts"
import { removeTemp } from "./testing.ts"

function world() {
  const root = mkdtempSync(join(tmpdir(), "naima-pointer-"))
  const program = join(root, "naima-tracker", "naima")
  mkdirSync(join(program, "docs", "agents"), { recursive: true })
  writeFileSync(join(program, "docs", "agents", "README.md"), "# Agents\n")
  return { root, program, cleanup: () => removeTemp(root) }
}

test("brokenEntryLinks: a markdown link and a plain-text path that name a missing file; a URL or an anchor is never one", () => {
  const w = world()
  try {
    writeFileSync(
      join(w.root, "AGENTS.md"),
      [
        "Read [docs/guide/rules.md](docs/guide/rules.md) before anything else.",
        "See also docs/missing/page.md for more.",
        "A link to https://example.invalid/README.md is not a local path.",
        "Nor is mailto:owner@example.invalid.",
        "A bare #heading names no file.",
      ].join("\n"),
    )
    const broken = brokenEntryLinks(w.root, ["AGENTS.md"])
    assert.deepEqual(broken, [{ file: "AGENTS.md", target: "docs/guide/rules.md" }, { file: "AGENTS.md", target: "docs/missing/page.md" }])
    mkdirSync(join(w.root, "docs", "guide"), { recursive: true })
    writeFileSync(join(w.root, "docs", "guide", "rules.md"), "# Rules\n")
    mkdirSync(join(w.root, "docs", "missing"), { recursive: true })
    writeFileSync(join(w.root, "docs", "missing", "page.md"), "# Page\n")
    assert.deepEqual(brokenEntryLinks(w.root, ["AGENTS.md"]), [])
  } finally {
    w.cleanup()
  }
})

test("brokenEntryLinks: a configured entry file that does not exist is skipped, not a problem", () => {
  const w = world()
  try {
    assert.deepEqual(brokenEntryLinks(w.root, ["CLAUDE.md", "AGENTS.md"]), [])
  } finally {
    w.cleanup()
  }
})

test("pointerLine and entryPointers: the one-line pointer at Naima's own agent docs, relative to the entry file", () => {
  const w = world()
  try {
    assert.equal(
      pointerLine(w.root, w.program, "AGENTS.md"),
      "Read [naima-tracker/naima/docs/agents/README.md](naima-tracker/naima/docs/agents/README.md) before anything else: it holds Naima's rules for agents.",
    )
    writeFileSync(join(w.root, "AGENTS.md"), "# Working here\n")
    const [p] = entryPointers(w.root, w.program, ["AGENTS.md", "CLAUDE.md"])
    assert.equal(p!.file, "AGENTS.md")
    assert.equal(p!.present, false)
    assert.equal(entryPointers(w.root, w.program, ["AGENTS.md", "CLAUDE.md"]).length, 1, "CLAUDE.md does not exist: not reported")
  } finally {
    w.cleanup()
  }
})

test("entryPointers: present once the file links to the agent docs, from wherever it names them", () => {
  const w = world()
  try {
    writeFileSync(join(w.root, "AGENTS.md"), "Read [naima-tracker/naima/docs/agents/README.md](naima-tracker/naima/docs/agents/README.md) first.\n")
    assert.equal(entryPointers(w.root, w.program, ["AGENTS.md"])[0]!.present, true)
  } finally {
    w.cleanup()
  }
})

test("writePointer: appends the pointer line under a blank line, once", () => {
  const w = world()
  try {
    writeFileSync(join(w.root, "AGENTS.md"), "# Working here\n\nSome rules.\n")
    writePointer(w.root, w.program, "AGENTS.md")
    const text = readFileSync(join(w.root, "AGENTS.md"), "utf8")
    assert.match(text, /# Working here\n\nSome rules\.\n\nRead \[naima-tracker\/naima\/docs\/agents\/README\.md]/)
    assert.equal(entryPointers(w.root, w.program, ["AGENTS.md"])[0]!.present, true)
  } finally {
    w.cleanup()
  }
})
