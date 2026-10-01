// Announceability: computed from user-facing, shipped, documented and checked by a person or end to end.

import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { addLink, type Context, createItem, type Item, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import announce from "../../../naima/src/plugins/announce/index.ts"
import docs from "../../../naima/src/plugins/docs/index.ts"
import gates from "../../../naima/src/plugins/gates/index.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

const make = (ctx: Context, type: string, title: string, fields: Record<string, unknown> = {}): Item => createItem(ctx, typeOrThrow(ctx, type), title, fields)
const fresh = (ctx: Context, item: Item): Item => ctx.repo.resolve(`${item.type}/${item.slug}`)

interface Row {
  item: string
  announceable: boolean
  major: boolean
  lacks: string[]
  checkedBy: string[]
}

async function rows(p: ReturnType<typeof tempProject>, ...args: string[]): Promise<Row[]> {
  p.output.length = 0
  assert.equal(await p.run("announce", "--json", ...args), 0)
  return JSON.parse(p.output.join("\n")) as Row[]
}

/** A shipped, documented, user-facing feature, and a passed proof of it run by `runBy`. */
function feature(ctx: Context, title: string, runBy: string, fields: Record<string, unknown> = {}): Item {
  const all: Record<string, unknown> = { status: "shipped", facing: "user", docs: ["docs/page.md"], fixedOn: "2026-01-10", ...fields }
  const f = make(ctx, "features", title, Object.fromEntries(Object.entries(all).filter(([, v]) => v !== null)))
  const t = make(ctx, "tests", `${title} works`, { runBy })
  addLink(ctx, fresh(ctx, t), "verifies", fresh(ctx, f))
  setFields(ctx, fresh(ctx, t), [["status", "passed"]])
  ctx.reload()
  return fresh(ctx, f)
}

test("a feature is announceable only once user-facing, shipped, documented and checked by a person or end to end", async () => {
  const p = tempProject([trackers(), docs(), gates({ gates: { v1: { title: "First" } } }), announce()])
  try {
    const { ctx } = p
    mkdirSync(join(ctx.root, "docs"), { recursive: true })
    writeFileSync(join(ctx.root, "docs/page.md"), "# Page\n")
    feature(ctx, "Search", "human", { major: true, gate: "v1" })
    feature(ctx, "Export", "agent-hands", { fixedOn: "2026-01-12" })
    feature(ctx, "Unit tested only", "agent")
    feature(ctx, "Internal cache", "human", { facing: "internal" })
    feature(ctx, "Sharing", "human", { docs: null })
    const unshipped = feature(ctx, "Themes", "human")
    setFields(ctx, unshipped, [["status", "planned"]])
    ctx.reload()

    const yes = await rows(p)
    assert.deepEqual(yes.map((r) => r.item), ["features/search", "features/export"], "major first, then the most recently shipped")
    assert.deepEqual(yes[0]?.checkedBy, ["tests/search-works"])

    const all = await rows(p, "--all")
    const lacks = (slug: string) => all.find((r) => r.item === `features/${slug}`)?.lacks.join("; ") ?? "absent"
    assert.match(lacks("unit-tested-only"), /not checked: no passed item verifies it with runBy human\|agent-hands/)
    assert.match(lacks("sharing"), /not documented/)
    assert.match(lacks("themes"), /not shipped: it is planned/)
    assert.equal(lacks("internal-cache"), "absent", "an internal feature is never listed, not even with --all")

    assert.deepEqual((await rows(p, "--since", "2026-01-11")).map((r) => r.item), ["features/export"])
    assert.deepEqual((await rows(p, "--gate", "v1")).map((r) => r.item), ["features/search"])
    await assert.rejects(p.run("announce", "--since", "yesterday"), /usage: naima announce/)

    p.output.length = 0
    assert.equal(await p.run("announce"), 0)
    assert.match(p.output.join("\n"), /^2 announceable\n {2}★ features\/search {2}Search {2}\(shipped 2026-01-10\)/)
  } finally {
    p.cleanup()
  }
})

test("a refuting proof outweighs a person's check; an owner-gesture counts whoever ran it", async () => {
  const p = tempProject([trackers(), docs(), announce()])
  try {
    const { ctx } = p
    const f = feature(ctx, "Search", "human")
    const bad = make(ctx, "tests", "Search on a phone")
    addLink(ctx, fresh(ctx, bad), "verifies", f)
    setFields(ctx, fresh(ctx, bad), [["status", "failed"]])
    feature(ctx, "Export", "agent", { fixedOn: "2026-01-11" })
    const proof = ctx.repo.resolve("tests/export-works")
    setFields(ctx, proof, [["evidenceKind", "owner-gesture"]])
    ctx.reload()
    const all = await rows(p, "--all")
    assert.deepEqual(all.filter((r) => r.announceable).map((r) => r.item), ["features/export"])
    assert.match(all.find((r) => r.item === "features/search")?.lacks.join() ?? "", /refuted/)
  } finally {
    p.cleanup()
  }
})

test("the public copy may name only announceable features, by label or title", async () => {
  const p = tempProject([trackers(), docs(), announce({ copy: ["README.md", "site/index.html"] })])
  try {
    const { ctx } = p
    feature(ctx, "Search", "human")
    feature(ctx, "Instant offline sync", "agent")
    writeFileSync(join(ctx.root, "README.md"), "# Tool\n\nNow with Search.\n")
    const problems = async () => (await runChecks(ctx)).problems.map((f) => f.message).join("\n")
    assert.doesNotMatch(await problems(), /names features/)
    writeFileSync(join(ctx.root, "README.md"), "# Tool\n\nNow with Search and instant\noffline sync.\n")
    assert.match(await problems(), /README\.md names features\/instant-offline-sync, which is not announceable: not checked/)
  } finally {
    p.cleanup()
  }
})
