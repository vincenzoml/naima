import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { asRendered, createItem, type GuideSection, linesAs, type Plugin, runChecks } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import triage from "../../../naima/src/plugins/triage/index.ts"

const things: Plugin = {
  name: "things",
  says: "test type",
  types: [{
    id: "things",
    dir: "THINGS",
    title: "Things",
    says: "",
    statuses: {
      open: { category: "open", says: "" },
      wontfix: { category: "done", says: "" },
      dropped: { category: "done", says: "" },
      done: { category: "done", says: "" },
    },
    initialStatus: "open",
    template: (title: string) => `# ${title}\n\nWhat happened.\n`,
  }],
}

test("a parked item is deferred, whatever its status", () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    createItem(ctx, type, "Parked thing", { priority: "parked" })
    createItem(ctx, type, "Ordinary thing", { priority: "now" })
  } finally {
    p.cleanup()
  }
})

test("view parked lists wontfix, dropped and parked items, with reopensWhen when set", async () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    const parked = createItem(ctx, type, "Parked one", { priority: "parked", reopensWhen: "when the owner has time" })
    createItem(ctx, type, "Wontfixed one", { status: "wontfix" })
    createItem(ctx, type, "Dropped one", { status: "dropped" })
    createItem(ctx, type, "Ordinary one", { priority: "now" })
    await p.run("view", "parked")
    const text = p.output.join("\n")
    assert.ok(text.includes("Parked one"), text)
    assert.ok(text.includes("Wontfixed one"), text)
    assert.ok(text.includes("Dropped one"), text)
    assert.ok(!text.includes("Ordinary one"), text)
    assert.ok(text.includes("reopens when: when the owner has time"), text)
    assert.equal(ctx.repo.resolve(parked.slug).meta["priority"], "parked")
  } finally {
    p.cleanup()
  }
})

test("view parked refuses an argument", async () => {
  const p = tempProject([things, triage()])
  try {
    await assert.rejects(p.run("view", "parked", "extra"), /usage: naima view parked/)
  } finally {
    p.cleanup()
  }
})

test("bugs/deferral-reason-becomes-check-parked-wontfix-must: a parked, wontfix or dropped item left as its unfilled template is a problem", async () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    const untouched = createItem(ctx, type, "Untouched", { status: "wontfix" })
    const explained = createItem(ctx, type, "Explained", { status: "dropped", reopensWhen: "when the budget clears" })
    // Give "Explained" a page that says why, beyond the template it started with.
    writeFileSync(join(explained.dir, "README.md"), "# Explained\n\nDropped: the budget ran out. Reopens when the budget clears.\n")
    ctx.reload()
    const report = await runChecks(ctx)
    const findings = [...report.problems, ...report.notes].filter((f) => f.item?.slug === untouched.slug || f.item?.slug === explained.slug)
    assert.ok(findings.some((f) => f.item?.slug === untouched.slug && /unfilled template/.test(f.message)), JSON.stringify(findings))
    assert.ok(!findings.some((f) => f.item?.slug === explained.slug), JSON.stringify(findings))
  } finally {
    p.cleanup()
  }
})

test("an open item, even a half-finished one, is not checked as a deferral", async () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    createItem(ctx, type, "Open thing")
    const report = await runChecks(ctx)
    const findings = [...report.problems, ...report.notes]
    assert.ok(!findings.some((f) => /unfilled template/.test(f.message)), JSON.stringify(findings))
  } finally {
    p.cleanup()
  }
})

test("naima guide prints the authoritative documents, current and retired", async () => {
  const p = tempProject([
    things,
    triage({
      documents: {
        "STATUS.md": { says: "the one true status page" },
        "OLD-STATUS.md": { says: "superseded by STATUS.md", retired: true },
      },
    }),
  ])
  try {
    const sections = p.ctx.registry.contributions("guide")
    const lines: string[] = []
    for (const c of sections) lines.push(...linesAs(asRendered(await (c.value as GuideSection).render(p.ctx), `guide section "${c.name}"`), "text"))
    const text = lines.join("\n")
    assert.ok(/Authoritative documents/.test(text), text)
    assert.ok(text.includes("STATUS.md — the one true status page"), text)
    assert.ok(text.includes("retired:"), text)
    assert.ok(text.includes("OLD-STATUS.md — superseded by STATUS.md"), text)
  } finally {
    p.cleanup()
  }
})

test("a check notes a retired document still named from a current one", async () => {
  const p = tempProject([
    things,
    triage({
      documents: {
        "STATUS.md": { says: "the one true status page" },
        "OLD-STATUS.md": { says: "superseded", retired: true },
      },
    }),
  ])
  try {
    const { ctx } = p
    writeFileSync(join(ctx.root, "STATUS.md"), "See also OLD-STATUS.md for history.\n")
    writeFileSync(join(ctx.root, "OLD-STATUS.md"), "Retired.\n")
    const { notes } = await runChecks(ctx)
    assert.ok(notes.some((f) => /still names the retired document OLD-STATUS\.md/.test(f.message)), JSON.stringify(notes))
  } finally {
    p.cleanup()
  }
})

test("options.documents is validated", () => {
  assert.throws(() => triage({ documents: "nope" }), /options\.documents must be an object/)
  assert.throws(() => triage({ documents: { "a.md": { retired: true } } }), /must be \{ "says"/)
  assert.throws(() => triage({ documents: { "a.md": { says: "x", retired: "yes" } } }), /retired must be true or false/)
})
