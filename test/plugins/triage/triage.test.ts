import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { byUrgency, type Context, createItem, type Plugin, runChecks } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import coordination from "../../../naima/src/plugins/coordination/index.ts"
import triage, { confidenceFrom } from "../../../naima/src/plugins/triage/index.ts"

/** `createItem` passes through the write hook that stamps `triagedOn` with today: back-date it on disk, as a person editing the file by hand would. */
function backdate(ctx: Context, item: { dir: string }, date: string): void {
  const file = join(item.dir, "meta.json")
  const meta = JSON.parse(readFileSync(file, "utf8"))
  meta.triagedOn = date
  writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`)
  ctx.reload()
}

const things: Plugin = {
  name: "things",
  says: "test type",
  types: [{
    id: "things",
    dir: "THINGS",
    title: "Things",
    says: "",
    statuses: { open: { category: "open", says: "" }, done: { category: "done", says: "" } },
    initialStatus: "open",
  }],
}

test("set stamps a human decision; derive never touches effort or a decided item", async () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    const a = createItem(ctx, type, "Measured crash")
    const b = createItem(ctx, type, "Vague report")
    await p.run("triage", "set", a.slug, "impact=high", "effort=S")
    let meta = ctx.repo.resolve(a.slug).meta
    assert.deepEqual([meta["impact"], meta["effort"], meta["triagedOn"], meta["triagedBy"]], ["high", "S", "2026-01-15", undefined])
    await assert.rejects(() => p.run("triage", "set", a.slug, "effort=huge"), /not one of/)

    await p.run("triage", "derive", "--write")
    meta = ctx.repo.resolve(b.slug).meta
    assert.deepEqual([meta["confidence"], meta["triagedBy"], meta["effort"]], ["reported", "derived", undefined])
    assert.equal(ctx.repo.resolve(a.slug).meta["confidence"], undefined, "a decided item is left alone")
    assert.deepEqual((await runChecks(ctx)).problems, [])
  } finally {
    p.cleanup()
  }
})

test("urgency: impact before priority, effort breaks ties, done sinks", () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    createItem(ctx, type, "low", { impact: "low", priority: "now" })
    createItem(ctx, type, "blocker big", { impact: "blocker", effort: "XL" })
    createItem(ctx, type, "blocker small", { impact: "blocker", effort: "S" })
    createItem(ctx, type, "finished", { impact: "blocker", effort: "S", status: "done" })
    assert.deepEqual(byUrgency(ctx, ctx.repo.items).map((i) => i.meta.title), ["blocker small", "blocker big", "low", "finished"])
  } finally {
    p.cleanup()
  }
})

test("an unset impact or priority counts as the middle of its scale, an unset effort as the largest size", () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    createItem(ctx, type, "sized XL", { impact: "high", priority: "now", effort: "XL" })
    createItem(ctx, type, "sized L", { impact: "high", priority: "now", effort: "L" })
    createItem(ctx, type, "unsized", { impact: "high", priority: "now" })
    createItem(ctx, type, "impact high", { impact: "high", priority: "next", effort: "M" })
    createItem(ctx, type, "impact medium", { impact: "medium", priority: "next", effort: "M" })
    createItem(ctx, type, "impact unset", { priority: "next", effort: "M" })
    const order = byUrgency(ctx, ctx.repo.items).map((i) => i.meta.title)
    // Unsized ties with XL, and the slug breaks the tie: it never passes a sized L.
    assert.ok(order.indexOf("sized L") < order.indexOf("unsized"), order.join(", "))
    assert.ok(order.indexOf("sized XL") < order.indexOf("unsized"), order.join(", "))
    // Unset impact sits between high and medium: the middle of blocker, high, medium, low.
    assert.ok(order.indexOf("impact high") < order.indexOf("impact unset") && order.indexOf("impact unset") < order.indexOf("impact medium"), order.join(", "))
  } finally {
    p.cleanup()
  }
})

test("confidence is read off the page's own words", () => {
  assert.equal(confidenceFrom("Reproduced twice and measured: 3.2 s"), "measured")
  assert.equal(confidenceFrom("The cause is a race"), "diagnosed")
  assert.equal(confidenceFrom("Not reproduced here"), "unclear")
  assert.equal(confidenceFrom("It broke"), "reported")
})

test("negated evidence is not evidence: a page that could not reproduce it is unclear, not measured", async () => {
  for (
    const text of [
      "Could not be reproduced on main.",
      "We were unable to reproduce it",
      "It has never been reproduced",
      "Not yet verified by anyone",
      "cannot confirm the crash",
      "wasn't measured",
    ]
  ) {
    assert.equal(confidenceFrom(text), "unclear", text)
  }
  assert.equal(confidenceFrom("Reproduced on main, and not only there"), "measured")
  assert.equal(confidenceFrom("It was not easy, but we reproduced it and measured 3 s"), "measured")
  const p = tempProject([things, triage()])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("things")!, "Flaky crash")
    writeFileSync(join(item.dir, "README.md"), "# Flaky crash\n\nThe crash could not be reproduced on a clean checkout.\n")
    await p.run("triage", "derive", "--write")
    assert.equal(p.ctx.repo.resolve(item.slug).meta["confidence"], "unclear")
  } finally {
    p.cleanup()
  }
})

test("view next takes a positive whole count", async () => {
  const p = tempProject([things, triage()])
  try {
    createItem(p.ctx, p.ctx.registry.types.get("things")!, "One")
    await assert.rejects(p.run("view", "next", "all"), /next: the count must be a positive whole number/)
    assert.equal(await p.run("view", "next", "1"), 0)
  } finally {
    p.cleanup()
  }
})

test("bugs/naima-triage-coverage-table-runs-effort-confidence: the coverage table's header keeps its columns apart", async () => {
  const p = tempProject([things, triage()])
  try {
    const type = p.ctx.registry.types.get("things")!
    createItem(p.ctx, type, "Crash", { effort: "S", confidence: "measured" })
    await p.run("triage")
    const header = p.output[0] ?? ""
    assert.ok(!/effortconfidence/.test(header), header)
    assert.match(header, /effort\s+confidence/)
    const row = p.output[1] ?? ""
    assert.equal(row.trim().split(/\s+/).length, 7, row) // type, open, priority, impact, effort, confidence, derived
  } finally {
    p.cleanup()
  }
})

test("each triage subcommand answers a misuse with its own usage", async () => {
  const p = tempProject([things, triage()])
  try {
    await assert.rejects(p.run("triage", "set", "x"), /^NaimaError: usage: naima triage set <item> field=value\.\.\.$/)
    await assert.rejects(p.run("triage", "missing", "extra"), /^NaimaError: usage: naima triage missing$/)
    await assert.rejects(p.run("triage", "derive", "extra"), /^NaimaError: usage: naima triage derive \[--write\]$/)
    await assert.rejects(
      p.run("triage", "nope"),
      /^NaimaError: usage: naima triage \| triage set <item> field=value\.\.\. \| triage missing \| triage derive \[--write\]$/,
    )
  } finally {
    p.cleanup()
  }
})

test("a triage field changed by any command stamps triagedOn and stops being derived; derive stamps nothing", async () => {
  const p = tempProject([things, triage()])
  try {
    const { ctx } = p
    const item = createItem(ctx, ctx.registry.types.get("things")!, "Crash")
    const meta = () => JSON.parse(readFileSync(join(item.dir, "meta.json"), "utf8"))
    assert.equal(await p.run("triage", "derive", "--write"), 0)
    assert.deepEqual([meta()["triagedBy"], meta()["triagedOn"]], ["derived", undefined], "derive is inference, not a person's triage")
    assert.equal(await p.run("set", "crash", "impact=high"), 0)
    assert.deepEqual([meta()["triagedBy"], meta()["triagedOn"]], [undefined, "2026-01-15"], "naima set of a triage field is triage")
    assert.equal(await p.run("set", "crash", "title=Crash on save"), 0)
    assert.equal(meta()["triagedOn"], "2026-01-15")
  } finally {
    p.cleanup()
  }
})

test("view next carries an age column, marking an unclaimed now item", async () => {
  const p = tempProject([things, triage()], { git: true })
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    backdate(ctx, createItem(ctx, type, "Stale now", { priority: "now" }), "2026-01-10") // 5 days old at FIXED_NOW
    await p.run("view", "next")
    const line = p.output.find((l) => l.includes("Stale now"))
    assert.match(line ?? "", /\(5d unclaimed\)/, p.output.join("\n"))
  } finally {
    p.cleanup()
  }
})

test("view next does not mark an item a branch's claim names", async () => {
  const p = tempProject([things, triage(), coordination()], { git: true })
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    const item = createItem(ctx, type, "Held now", { priority: "now" })
    backdate(ctx, item, "2026-01-10")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "item")
    await p.run("claim", item.slug)
    await p.run("view", "next")
    const line = p.output.find((l) => l.includes("Held now"))
    assert.match(line ?? "", /\(5d\)/, p.output.join("\n"))
    assert.ok(!/unclaimed/.test(line ?? ""), line)
  } finally {
    p.cleanup()
  }
})

test("unclaimed-now-item-aging notes a now item open past the configured age with no claim on it", async () => {
  const p = tempProject([things, triage({ maxNowAgeDays: 2 }), coordination()], { git: true })
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("things")!
    backdate(ctx, createItem(ctx, type, "Fresh now", { priority: "now" }), "2026-01-14") // 1 day: under the limit
    backdate(ctx, createItem(ctx, type, "Stale now", { priority: "now" }), "2026-01-10") // 5 days: over it
    const held = createItem(ctx, type, "Held stale now", { priority: "now" })
    backdate(ctx, held, "2026-01-10")
    backdate(ctx, createItem(ctx, type, "Stale later", { priority: "later" }), "2026-01-10") // not `now`
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    await p.run("claim", held.slug)

    const report = await runChecks(ctx)
    const messages = report.notes.map((f) => f.message)
    assert.ok(messages.some((m) => m.includes("stale-now") && m.includes("5 days")), messages.join("\n"))
    assert.ok(!messages.some((m) => m.includes("fresh-now")), messages.join("\n"))
    assert.ok(!messages.some((m) => m.includes("held-stale-now")), messages.join("\n"))
    assert.ok(!messages.some((m) => m.includes("stale-later")), messages.join("\n"))
    assert.deepEqual(report.problems, [])
  } finally {
    p.cleanup()
  }
})

test("triage: options.maxNowAgeDays must be a positive whole number", () => {
  assert.throws(() => triage({ maxNowAgeDays: 0 }), /options\.maxNowAgeDays/)
  assert.throws(() => triage({ maxNowAgeDays: "3" }), /options\.maxNowAgeDays/)
})

test("a change that touches no triage field stamps nothing", async () => {
  const p = tempProject([things, triage()])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("things")!, "Crash")
    assert.equal(await p.run("set", "crash", "title=Crash on save"), 0)
    assert.equal(JSON.parse(readFileSync(join(item.dir, "meta.json"), "utf8"))["triagedOn"], undefined)
  } finally {
    p.cleanup()
  }
})
