// The agent-harness entry-point check's own functions, isolated from a full
// project: what a plain-text path or a markdown link resolves to, and the
// pointer `naima init --write-agent-pointer` writes
// (features/agent-harness-entry-point-check-naima-init).

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { agentPointer, brokenEntryLinks, pointerLine, writePointer } from "../../naima/src/core/pointer.ts"
import { removeTemp } from "./testing.ts"

function world() {
  const root = mkdtempSync(join(tmpdir(), "naima-pointer-"))
  const program = join(root, "naima-tracker", "naima")
  mkdirSync(join(program, "docs", "agents"), { recursive: true })
  writeFileSync(join(program, "docs", "agents", "README.md"), "# Agents\n")
  return { root, program, tracker: join(root, "naima-tracker"), cleanup: () => removeTemp(root) }
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

test("pointerLine and agentPointer: one line saying where Naima is, for AGENTS.md, else CLAUDE.md, else a new AGENTS.md", () => {
  const w = world()
  try {
    assert.equal(
      pointerLine(w.root, w.tracker),
      "Naima is in naima-tracker/ (naima/ the program, naima-data/ the data); if you find it elsewhere, update this line.",
    )
    assert.deepEqual(
      agentPointer(w.root, w.tracker, ["CLAUDE.md"]),
      { file: "AGENTS.md", line: pointerLine(w.root, w.tracker), present: false },
      "none: AGENTS.md, created",
    )
    writeFileSync(join(w.root, "CLAUDE.md"), "# Claude\n")
    assert.equal(agentPointer(w.root, w.tracker, ["CLAUDE.md"]).file, "CLAUDE.md")
    writeFileSync(join(w.root, "AGENTS.md"), "# Working here\n")
    assert.equal(agentPointer(w.root, w.tracker, ["CLAUDE.md"]).file, "AGENTS.md", "AGENTS.md first")
  } finally {
    w.cleanup()
  }
})

test("agentPointer: present once any entry file says where Naima is, or links its agent docs as an earlier pointer did", () => {
  const w = world()
  try {
    writeFileSync(join(w.root, "GEMINI.md"), "Naima is in elsewhere/ (naima/ the program, naima-data/ the data); if you find it elsewhere, update this line.\n")
    assert.equal(agentPointer(w.root, w.tracker, ["GEMINI.md"]).present, true)
    writeFileSync(join(w.root, "GEMINI.md"), "")
    writeFileSync(join(w.root, "CLAUDE.md"), "Read [naima-tracker/naima/docs/agents/README.md](naima-tracker/naima/docs/agents/README.md) first.\n")
    assert.equal(agentPointer(w.root, w.tracker, []).present, true)
  } finally {
    w.cleanup()
  }
})

test("writePointer: appends the pointer line under a blank line, once, creating the file when there is none", () => {
  const w = world()
  try {
    writeFileSync(join(w.root, "AGENTS.md"), "# Working here\n\nSome rules.\n")
    writePointer(w.root, w.tracker, "AGENTS.md")
    const text = readFileSync(join(w.root, "AGENTS.md"), "utf8")
    assert.equal(text, "# Working here\n\nSome rules.\n\n" + pointerLine(w.root, w.tracker) + "\n")
    assert.equal(agentPointer(w.root, w.tracker, ["AGENTS.md"]).present, true)
    writePointer(w.root, w.tracker, "CLAUDE.md")
    assert.equal(readFileSync(join(w.root, "CLAUDE.md"), "utf8"), pointerLine(w.root, w.tracker) + "\n")
  } finally {
    w.cleanup()
  }
})
