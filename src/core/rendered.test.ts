// Views and summary sections render data once, and the data reads as text,
// JSON or markdown; checks, views and summary sections may be async; a
// contract-1 view that returns plain lines keeps working.

import assert from "node:assert/strict"
import { test } from "node:test"
import { type Finding, groupBy, type Plugin, rendered, runChecks } from "./internal.ts"
import { tempProject } from "./testing.ts"

const delay = <T>(value: T): Promise<T> => new Promise((done) => setTimeout(() => done(value), 1))

const plugin: Plugin = {
  name: "stats",
  says: "renders data",
  views: [
    {
      name: "counts",
      says: "items by status, awaited",
      async render(_args, ctx) {
        const data = await delay([...groupBy(ctx.repo.items, (i) => i.meta.status)].map(([status, items]) => ({ status, n: items.length })))
        return rendered(
          data,
          (rows) => rows.map((r) => `${r.status}: ${r.n}`),
          (rows) => ["| Status | Items |", "|---|---|", ...rows.map((r) => `| ${r.status} | ${r.n} |`)],
        )
      },
    },
    // A contract-1 view: its lines are its text and its data both.
    { name: "legacy", says: "plain lines", render: () => ["one", "two"] as unknown as ReturnType<typeof rendered> },
  ],
  summary: [{ name: "stats", render: (ctx) => delay(rendered({ items: ctx.repo.items.length }, (d) => [`  ${d.items} items`])) }],
  checks: [
    { name: "slow", says: "an async check", run: () => delay<Finding[]>([{ level: "note", message: "checked, slowly" }]) },
    { name: "broken", says: "an async check that rejects", run: () => Promise.reject(new Error("tool unreachable")) },
  ],
}

test("a view renders its data once: as text, its data as JSON, or its markdown", async () => {
  const p = tempProject([plugin, {
    name: "notes",
    says: "a type",
    types: [{ id: "notes", dir: "notes", title: "Notes", says: "notes", statuses: { open: { category: "open", says: "open" } }, initialStatus: "open" }],
  }])
  try {
    await p.run("new", "notes", "First")
    await p.run("new", "notes", "Second")
    p.output.length = 0
    await p.run("view", "counts")
    assert.deepEqual(p.output, ["open: 2"])
    p.output.length = 0
    await p.run("view", "--json", "counts")
    assert.deepEqual(JSON.parse(p.output.join("\n")), [{ status: "open", n: 2 }])
    p.output.length = 0
    await p.run("view", "--markdown", "counts")
    assert.deepEqual(p.output, ["| Status | Items |", "|---|---|", "| open | 2 |"])
    p.output.length = 0
    await p.run("view", "--markdown", "legacy")
    assert.deepEqual(p.output, ["one", "two"], "a view with no markdown of its own is printed as its text")
    p.output.length = 0
    await p.run("view", "--json", "legacy")
    assert.deepEqual(JSON.parse(p.output.join("\n")), ["one", "two"], "a contract-1 view's lines are its data too")
  } finally {
    p.cleanup()
  }
})

test("summary prints every section's text, its data as JSON, or markdown under a heading each", async () => {
  const p = tempProject([plugin])
  try {
    await p.run("summary", "--json")
    assert.deepEqual(JSON.parse(p.output.join("\n"))["stats"], { items: 0 })
    p.output.length = 0
    await p.run("summary")
    assert.match(p.output.join("\n"), /── stats\n {2}0 items/)
    p.output.length = 0
    await p.run("summary", "--markdown")
    assert.match(p.output.join("\n"), /## stats\n\n {2}0 items/)
    await assert.rejects(p.run("summary", "--json", "--markdown"), /usage: naima summary/)
  } finally {
    p.cleanup()
  }
})

test("a check may be async: awaited in load order, and one that rejects is a problem, never a crash", async () => {
  const p = tempProject([plugin])
  try {
    const { problems, notes } = await runChecks(p.ctx)
    assert.ok(notes.some((f) => f.message === "checked, slowly"))
    assert.ok(problems.some((f) => f.message === 'check "broken" failed to run: tool unreachable'))
  } finally {
    p.cleanup()
  }
})
