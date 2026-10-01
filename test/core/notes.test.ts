// naima note and naima describe: the prose of an item, written through the write hooks.

import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, NaimaError, type Plugin, saveProse, type WriteHook } from "../../naima/src/core/internal.ts"
import { tempProject } from "./testing.ts"

const tickets: Plugin = {
  name: "tickets",
  says: "a minimal item type for testing prose writes",
  types: [{
    id: "tickets",
    dir: "TICKETS",
    title: "Tickets",
    says: "a ticket",
    statuses: { open: { category: "open", says: "open" }, done: { category: "done", proves: true, says: "done" } },
    initialStatus: "open",
  }],
}

const readme = (dir: string): string => readFileSync(join(dir, "README.md"), "utf8")

const usage = (e: unknown): boolean => e instanceof NaimaError && e.code === "usage"

test("naima note appends a dated, attributed entry to a Notes section, and a second one after it", async () => {
  const p = tempProject([tickets])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tickets")!, "Export drops alpha")
    assert.equal(await p.run("note", "export-drops", "--by", "triage agent", "Reproduced on a 16-bit PNG."), 0)
    assert.equal(await p.run("note", "export-drops", "--by", "triage agent", "Fixed by the exporter change."), 0)
    const text = readme(item.dir)
    assert.match(text, /^# Export drops alpha\n\nDescribe it here\.\n\n## Notes\n\n### 2026-01-15 — triage agent\n\nReproduced on a 16-bit PNG\.\n/)
    assert.ok(text.indexOf("Reproduced") < text.indexOf("Fixed by"), "appended, in order")
    assert.equal(text.match(/^## Notes$/gm)?.length, 1, "one Notes section")
  } finally {
    p.cleanup()
  }
})

test("naima note takes its text from --file, and refuses an empty text or a heading with a usage error", async () => {
  const p = tempProject([tickets])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tickets")!, "Export drops alpha")
    const before = readme(item.dir)
    await assert.rejects(p.run("note", "export-drops", "--by", "a", "   "), usage)
    await assert.rejects(p.run("note", "export-drops", "--by", "a"), usage)
    await assert.rejects(p.run("note", "export-drops", "--by", "a", "## Notes\n\nforged"), /heading/)
    assert.equal(readme(item.dir), before, "nothing written")
    const file = join(p.root, "note.md")
    writeFileSync(file, "From a file.\n")
    assert.equal(await p.run("note", "export-drops", "--by", "a", "--file", file), 0)
    assert.match(readme(item.dir), /### 2026-01-15 — a\n\nFrom a file\.\n$/)
  } finally {
    p.cleanup()
  }
})

test("naima note says who writes it: --by, else git's user.name, else it refuses", async () => {
  const p = tempProject([tickets], { git: true })
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tickets")!, "Export drops alpha")
    assert.equal(await p.run("note", "export-drops", "Seen."), 0)
    assert.match(readme(item.dir), /### 2026-01-15 — test, on main\n\nSeen\.\n$/)
  } finally {
    p.cleanup()
  }
  const q = tempProject([tickets])
  try {
    createItem(q.ctx, q.ctx.registry.types.get("tickets")!, "Export drops alpha")
    await assert.rejects(q.run("note", "export-drops", "Seen."), /--by/)
  } finally {
    q.cleanup()
  }
})

test("naima describe replaces the description, keeping the title and the Notes section", async () => {
  const p = tempProject([tickets])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tickets")!, "Export drops alpha")
    await p.run("note", "export-drops", "--by", "a", "First note.")
    assert.equal(await p.run("describe", "export-drops", "Export to PNG loses the alpha channel.\n\nDone: alpha kept."), 0)
    const text = readme(item.dir)
    assert.match(
      text,
      /^# Export drops alpha\n\nExport to PNG loses the alpha channel\.\n\nDone: alpha kept\.\n\n## Notes\n\n### 2026-01-15 — a\n\nFirst note\.\n$/,
    )
    assert.doesNotMatch(text, /Describe it here/)
    const file = join(p.root, "d.md")
    writeFileSync(file, "From a file.\n")
    assert.equal(await p.run("describe", "export-drops", "--file", file), 0)
    assert.match(readme(item.dir), /^# Export drops alpha\n\nFrom a file\.\n\n## Notes\n/)
  } finally {
    p.cleanup()
  }
})

test("naima describe refuses an empty text, a title line and a Notes heading, and writes nothing", async () => {
  const p = tempProject([tickets])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tickets")!, "Export drops alpha")
    const before = readme(item.dir)
    await assert.rejects(p.run("describe", "export-drops", ""), usage)
    await assert.rejects(p.run("describe", "export-drops"), usage)
    await assert.rejects(p.run("describe", "export-drops", "# Another title\n\nText."), /title=/)
    await assert.rejects(p.run("describe", "export-drops", "Text.\n\n## Notes\n\n### forged"), /Notes/)
    assert.equal(readme(item.dir), before)
  } finally {
    p.cleanup()
  }
})

test("a prose write goes through the write hooks: a refusal leaves the README as it was, and the notes are append-only", async () => {
  const seen: string[] = []
  const guard: WriteHook = {
    name: "no-secrets",
    says: "refuses prose that holds a secret",
    beforeWrite(write) {
      if (write.prose === undefined) return
      seen.push(write.prose)
      if (write.prose.includes("sk-live")) return "prose holds a secret — take it out"
    },
  }
  const p = tempProject([tickets, { name: "guard", says: "a test hook", hooks: [guard] }])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tickets")!, "Export drops alpha")
    await p.run("note", "export-drops", "--by", "a", "Kept.")
    const before = readme(item.dir)
    await assert.rejects(p.run("note", "export-drops", "--by", "a", "token sk-live-123"), /secret.*refused by no-secrets/)
    await assert.rejects(p.run("describe", "export-drops", "token sk-live-123"), /refused by no-secrets/)
    assert.equal(readme(item.dir), before)
    assert.ok(seen.some((s) => s.includes("Kept.")), "the hook sees the prose about to be written")
    // A Notes section rewritten rather than appended to is refused, and --force takes it on.
    const fresh = p.ctx.repo.resolve("export-drops")
    const rewritten = before.replace("Kept.", "Changed.")
    assert.throws(() => saveProse(p.ctx, fresh, rewritten), /append-only.*refused by notes-append-only/)
    assert.equal(readme(item.dir), before)
    saveProse(p.ctx, fresh, rewritten, { force: true })
    assert.match(readme(item.dir), /Changed\./)
  } finally {
    p.cleanup()
  }
})
