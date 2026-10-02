// Defined value lists for classifier fields: a project or a plugin declares
// the values area and kind take, each with a title and what it means; the
// check reports a value off the list — a note for an open list (area, kind),
// a problem for a fixed one (gate, epic) — and never rewrites the item;
// `naima types` prints each value with how many items hold it.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { firstParty, firstPartyPlugins } from "../../naima/src/builtins.ts"
import { buildRegistry, FORMAT, type Plugin, runChecks, runCli } from "../../naima/src/core/internal.ts"
import { corePlugin } from "../../naima/src/core/base.ts"
import { gitIn, removeTemp, tempProject } from "./testing.ts"

const areas: Plugin = {
  name: "areas",
  says: "the surfaces this project's work lives on",
  extends: [
    { field: "area", values: { cli: { title: "Command line", says: "the naima command and its output" }, docs: "the guide and the reference" } },
    { field: "kind", values: { code: "a change to the program", tester: "a gesture for the tester role" } },
  ],
}

test("a string field takes an open list of values, each with a title and what it means, from any plugin", () => {
  const r = buildRegistry([corePlugin, ...firstPartyPlugins(), areas])
  const area = r.fields.get("area")
  assert.equal(area?.kind, "string", "it stays a string: the list is open")
  assert.deepEqual(area?.values, { cli: "the naima command and its output", docs: "the guide and the reference" })
  assert.deepEqual(area?.titles, { cli: "Command line" })
  assert.ok(Object.hasOwn(r.fields.get("kind")?.values ?? {}, "tester"), "kind may name a role")
  const more: Plugin = { name: "more", says: "", extends: [{ field: "area", values: { site: "the website" } }] }
  assert.deepEqual(Object.keys(buildRegistry([corePlugin, ...firstPartyPlugins(), areas, more]).fields.get("area")?.values ?? {}), ["cli", "docs", "site"])
  const dated: Plugin = { name: "dated", says: "", extends: [{ field: "fixedOn", values: { soon: "later" } }] }
  assert.throws(() => buildRegistry([corePlugin, ...firstPartyPlugins(), dated]), /extends field "fixedOn" with values, and it is a date/)
  const shapeless: Plugin = { name: "shapeless", says: "", extends: [{ field: "area", values: { web: 3 as unknown as string } }] }
  assert.throws(() => buildRegistry([corePlugin, ...firstPartyPlugins(), shapeless]), /value "web" is what it means, or \{ "title", "says" \}/)
})

test("a value off an open list is a note naming the items, and the items are left as they are", async () => {
  const p = tempProject([...firstPartyPlugins(), areas])
  try {
    assert.equal(await p.run("new", "bugs", "Crash on start", "--set", "area=cli"), 0)
    assert.equal(await p.run("new", "bugs", "Help typo", "--set", "area=help"), 0)
    assert.equal(await p.run("new", "todos", "Reword help", "--set", "area=help", "--set", "kind=vibes"), 0)
    const before = readFileSync(join(p.ctx.repo.resolve("help-typo").dir, "meta.json"), "utf8")
    p.ctx.reload()
    const { problems, notes } = await runChecks(p.ctx)
    const said = notes.map((n) => n.message)
    assert.ok(said.some((m) => /area "help" is not on its list \(cli, docs\): 2 items — bugs\/help-typo, todos\/reword-help/.test(m)), said.join("\n"))
    assert.ok(said.some((m) => /kind "vibes" is not on its list/.test(m)), said.join("\n"))
    assert.ok(!said.some((m) => /area "cli"/.test(m)), "a value on the list is not reported")
    assert.ok(!problems.some((f) => /not on its list/.test(f.message)), "an open list never fails the check")
    assert.equal(readFileSync(join(p.ctx.repo.resolve("help-typo").dir, "meta.json"), "utf8"), before, "the check rewrites nothing")
  } finally {
    p.cleanup()
  }
})

test("a field with no list declared is not checked against one", async () => {
  const p = tempProject([...firstPartyPlugins()])
  try {
    assert.equal(await p.run("new", "bugs", "Crash", "--set", "area=anything"), 0)
    p.ctx.reload()
    assert.ok(!(await runChecks(p.ctx)).notes.some((n) => /not on its list/.test(n.message)))
  } finally {
    p.cleanup()
  }
})

test("gate and epic are fixed lists: a value off them is a problem", async () => {
  const p = tempProject([...firstPartyPlugins({ gates: { gates: { v1: { title: "First" } } } })])
  try {
    assert.equal(await p.run("new", "bugs", "Crash"), 0)
    assert.equal(await p.run("new", "bugs", "Hang"), 0)
    const crash = p.ctx.repo.resolve("crash")
    writeFileSync(join(crash.dir, "meta.json"), JSON.stringify({ ...crash.meta, gate: "v9" }))
    const hang = p.ctx.repo.resolve("hang")
    writeFileSync(join(hang.dir, "meta.json"), JSON.stringify({ ...hang.meta, links: [{ rel: "part-of", id: crash.meta.id }] }))
    p.ctx.reload()
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message)
    assert.ok(problems.some((m) => /gate "v9" is not one of: v1/.test(m)), problems.join("\n"))
    assert.ok(problems.some((m) => /is part of bugs\/crash, which is not an epic/.test(m)), problems.join("\n"))
  } finally {
    p.cleanup()
  }
})

test("naima types prints each field's values, with their titles and how many items hold each, off-list ones marked", async () => {
  const p = tempProject([...firstPartyPlugins({ gates: { gates: { v1: { title: "First" } } } }), areas])
  try {
    assert.equal(await p.run("new", "bugs", "Crash", "--set", "area=cli", "--set", "gate=v1"), 0)
    assert.equal(await p.run("new", "bugs", "Hang", "--set", "area=cli"), 0)
    assert.equal(await p.run("new", "bugs", "Typo", "--set", "area=help"), 0)
    p.output.length = 0
    assert.equal(await p.run("types"), 0)
    const out = p.output.join("\n")
    assert.match(out, /^area — open list$/m)
    assert.match(out, /^ {2}cli +2 +Command line — the naima command and its output$/m)
    assert.match(out, /^ {2}docs +0 +the guide and the reference$/m)
    assert.match(out, /^ {2}help +1 +not on the list$/m)
    assert.match(out, /^gate — fixed list$/m)
    assert.match(out, /^ {2}v1 +1 +First$/m)
  } finally {
    p.cleanup()
  }
})

test("a project declares its values in naima.json, and check passes with a note for an off-list value", async () => {
  const base = mkdtempSync(join(tmpdir(), "naima-values-"))
  const root = join(base, "project")
  const data = join(root, "naima-tracker", "naima-data")
  mkdirSync(data, { recursive: true })
  gitIn(root, "init", "-q", "-b", "main")
  writeFileSync(
    join(data, "naima.json"),
    JSON.stringify({
      format: FORMAT,
      formats: { gates: 2 },
      source: "https://example.invalid/naima.git",
      commit: "0".repeat(40),
      extends: [{ field: "area", values: { cli: { title: "Command line", says: "the naima command" } } }],
    }),
  )
  const out: string[] = []
  const io = { out: (l = "") => void out.push(l), err: (l: string) => void out.push(l), now: () => new Date("2026-01-15T10:00:00Z") }
  const run = (...argv: string[]) => runCli(argv, { cwd: root, data: join(root, "naima-tracker", "naima-data"), programRoot: base, firstParty, io })
  try {
    assert.equal(await run("new", "bugs", "Crash", "--set", "area=web"), 0, out.join("\n"))
    out.length = 0
    await run("check")
    assert.match(out.join("\n"), /area "web" is not on its list \(cli\): 1 item — bugs\/crash/)
    assert.doesNotMatch(out.join("\n"), /problem[^\n]*not on its list/)
  } finally {
    removeTemp(base)
  }
})
