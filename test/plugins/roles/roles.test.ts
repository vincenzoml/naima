// Roles: the company of agents as data, the kind vocabulary they declare, and one role's queue.

import assert from "node:assert/strict"
import { test } from "node:test"
import { type Context, createItem, type Item, runChecks, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import gates from "../../../naima/src/plugins/gates/index.ts"
import roles, { DEFAULT_ROLES } from "../../../naima/src/plugins/roles/index.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

const make = (ctx: Context, type: string, title: string, fields: Record<string, unknown> = {}): Item => createItem(ctx, typeOrThrow(ctx, type), title, fields)

test("every default role says what it owns and what it refuses, and the roles named in the purpose are all there", () => {
  const names = DEFAULT_ROLES.map((r) => r.name)
  for (
    const n of [
      "owner",
      "coordinator",
      "lead-developer",
      "implementer",
      "tester",
      "evidence-owner",
      "filer",
      "verification-engineer",
      "release-manager",
      "documentarian",
      "announcer",
      "community-steward",
      "business",
    ]
  ) {
    assert.ok(names.includes(n), n)
  }
  for (const r of DEFAULT_ROLES) assert.ok(r.owns && r.refuses.length && r.refuses.every((s) => s.trim()), r.name)
  assert.throws(() => roles({ roles: { judge: { title: "Judge", owns: "rulings", refuses: [] } } }), /role "judge" does not say what it refuses/)
})

test("naima queue --role lists one role's open items, most urgent first, by role, kind or type, and on a gate when one is named", async () => {
  const p = tempProject([
    trackers(),
    gates({ gates: { v1: { title: "First" } } }),
    roles({ roles: { judge: { title: "Judge", owns: "rulings", refuses: ["ruling on its own case"], kinds: ["ruling"] } } }),
  ])
  try {
    const { ctx } = p
    make(ctx, "todos", "Parser code", { kind: "code", gate: "v1" })
    make(ctx, "todos", "Lexer refactor", { kind: "refactor" })
    make(ctx, "todos", "Parser explanation", { kind: "code", role: "documentarian" })
    make(ctx, "tests", "Manual parse")
    make(ctx, "todos", "Name ruling", { kind: "ruling" })
    make(ctx, "todos", "Finished code", { kind: "code", status: "done" })
    ctx.reload()

    assert.equal(await p.run("queue", "--role", "implementer"), 0)
    const out = p.output.join("\n")
    assert.match(out, /^implementer — Implementer: 2 open\n {2}refuses: widening scope; spawning workers; touching the trunk/)
    assert.match(out, /todos\/parser-code {2}Parser code {2}\(code\)/)
    assert.match(out, /todos\/lexer-refactor/)
    assert.doesNotMatch(out, /parser-explanation|finished-code/, "an explicit role wins over the kind; a closed item is on no queue")
    assert.ok(out.indexOf("parser-code") < out.indexOf("lexer-refactor"), "the gated item is the more urgent")

    p.output.length = 0
    assert.equal(await p.run("queue", "v1", "--role", "implementer"), 0)
    assert.match(p.output.join("\n"), /implementer — Implementer on v1: 1 open/)

    p.output.length = 0
    await p.run("queue", "--role", "documentarian")
    assert.match(p.output.join("\n"), /parser-explanation/)
    p.output.length = 0
    await p.run("queue", "--role", "tester")
    assert.match(p.output.join("\n"), /tests\/manual-parse/, "a tests item is the tester's by its type")
    p.output.length = 0
    await p.run("queue", "--role", "judge")
    assert.match(
      p.output.join("\n"),
      /judge — Judge: 1 open\n {2}refuses: ruling on its own case\n {2}todos\/name-ruling/,
      "a project's own role, from the configuration",
    )

    await assert.rejects(p.run("queue", "--role", "astronaut"), /no role "astronaut" — roles: owner, coordinator/)

    p.output.length = 0
    assert.equal(await p.run("roles", "--json"), 0)
    const rows = JSON.parse(p.output.join("\n")) as { name: string; open: number; refuses: string[] }[]
    assert.equal(rows.find((r) => r.name === "implementer")?.open, 2)
    assert.equal(rows.length, DEFAULT_ROLES.length + 1)
  } finally {
    p.cleanup()
  }
})

test("the kinds the roles take are the vocabulary of kind: a kind no role takes is a note, never refused", async () => {
  const p = tempProject([trackers(), roles()])
  try {
    make(p.ctx, "todos", "Polish", { kind: "vibes" })
    make(p.ctx, "todos", "Ship", { kind: "code" })
    p.ctx.reload()
    const notes = (await runChecks(p.ctx)).notes.map((f) => f.message).join("\n")
    assert.match(notes, /kind "vibes" is not on its list/)
    assert.doesNotMatch(notes, /kind "code"/)
  } finally {
    p.cleanup()
  }
})

test("without the roles plugin, queue --role says so instead of listing nothing", async () => {
  const p = tempProject([trackers(), gates()])
  try {
    await assert.rejects(p.run("queue", "--role", "tester"), /the roles plugin is not loaded/)
  } finally {
    p.cleanup()
  }
})
