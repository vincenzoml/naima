// The timeline: every event derived from the items and git, nothing stored; what has no date counted, never placed.

import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { addLink, createItem, type Plugin, saveMeta, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import coordination from "../../../naima/src/plugins/coordination/index.ts"
import epics from "../../../naima/src/plugins/epics/index.ts"
import gates from "../../../naima/src/plugins/gates/index.ts"
import ui, { viewsOf } from "../../../naima/src/plugins/ui/index.ts"

const open = { category: "open" as const, says: "" }
const fixture = (): Plugin => ({
  name: "fixture",
  says: "work items",
  types: [{ id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open, closed: { category: "done", says: "" } }, initialStatus: "open" }],
  fields: [
    { name: "fixedOn", kind: "date", says: "" },
    { name: "closedOn", kind: "date", says: "" },
    { name: "runBy", kind: "string", says: "" },
    { name: "humanBecause", kind: "string", says: "" },
  ],
  relations: [
    { name: "verifies", inverse: "verified-by", says: "" },
    { name: "verified-by", inverse: "verifies", says: "" },
  ],
})

test("the timeline derives gates, epics, releases, sessions and records, oldest first, and counts what has no date", async () => {
  const p = tempProject([fixture(), gates({ gates: { beta: { title: "Public beta" }, rc: { title: "Candidate" } } }), epics(), coordination(), ui()], {
    git: true,
  })
  try {
    const { ctx } = p
    const bug = (title: string, meta: Record<string, unknown>) => {
      const i = createItem(ctx, typeOrThrow(ctx, "bugs"), title)
      saveMeta(ctx, { ...i, meta: { ...i.meta, ...meta } })
      return ctx.repo.resolve(i.slug)
    }
    bug("Crash", { created: "2026-01-02", status: "closed", closedOn: "2026-01-10", gate: "beta" })
    bug("Hang", { created: "2026-01-05", status: "closed", fixedOn: "2026-01-12", gate: "beta" })
    bug("Leak", { created: "2026-03-01", status: "closed", gate: "rc" }) // resolved, with no date to say when
    const epic = createItem(ctx, typeOrThrow(ctx, "epics"), "Onboarding")
    const member = bug("First run", { created: "2026-02-01" })
    addLink(ctx, member, "part-of", ctx.repo.resolve(`epics/${epic.slug}`))
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    p.git("tag", "v0.1")
    p.git("tag", "not-a-version")
    assert.equal(await p.run("pass", "Shipped the beta"), 0)
    assert.equal(await p.run("event", "2026-01-20", "Build 3 handed to the testers", "--kind", "build"), 0)
    assert.equal(readdirSync(join(ctx.trackerRoot, "events")).length, 1, "a record is one file per event")
    await assert.rejects(p.run("event", "2026-13-01", "no such day"), /an event's date is YYYY-MM-DD/)

    p.output.length = 0
    assert.equal(await p.run("view", "--json", "timeline"), 0)
    const t = JSON.parse(p.output.join("\n")) as { events: { date: string; kind: string; subject: string }[]; undated: Record<string, number> }
    const today = ctx.now().toISOString().slice(0, 10)
    const tagged = p.git("log", "-1", "--format=%cs")
    const brief = t.events.map((e) => `${e.date} ${e.kind} ${e.subject}`)
    assert.deepEqual(brief.filter((e) => !/ (release|session) /.test(e)), [
      "2026-01-02 gate opened beta",
      "2026-01-12 gate passed beta",
      "2026-01-20 record build",
      "2026-02-01 epic opened epics/onboarding",
      "2026-03-01 gate opened rc",
    ])
    assert.ok(brief.includes(`${tagged} release v0.1`), "a version tag is a release, dated by its commit")
    assert.ok(!brief.some((e) => e.includes("not-a-version")), "a tag that names no version is not one")
    assert.ok(brief.includes(`${today} session main`), "a session is its note")
    assert.deepEqual(t.undated, { "gate passed": 1 }, "rc passed, but its item says no date: counted, not placed")
    assert.ok(!brief.some((e) => e.includes("epic finished")), "an epic with an open item has not finished")

    p.output.length = 0
    assert.equal(await p.run("view", "timeline"), 0)
    assert.match(p.output.join("\n"), /^2026-01-02 {2}gate opened +gate beta \(Public beta\): the first of its 2 items reported$/m)
    assert.match(p.output.join("\n"), /undated, not placed: gate passed 1/)

    const view = viewsOf(ctx).find((v) => v.name === "timeline")
    assert.ok(view, "the timeline is a tab of naima ui")
    const r = await view.render({}, ctx)
    assert.match(r.html, /<td>2026-01-12<\/td><td>gate passed<\/td>/)
  } finally {
    p.cleanup()
  }
})

test("without gates or epics loaded, the timeline still shows releases, sessions and records", async () => {
  const p = tempProject([fixture(), coordination()], { git: true })
  try {
    assert.equal(await p.run("event", "2026-05-05", "Support for v1 ended", "--kind", "fact"), 0)
    p.output.length = 0
    assert.equal(await p.run("view", "timeline"), 0)
    assert.match(p.output.join("\n"), /^2026-05-05 {2}record +fact: Support for v1 ended$/m)
  } finally {
    p.cleanup()
  }
})
