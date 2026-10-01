// Coverage of a normative list: each entry, read from its source on every run, with the test that proves it or NO TEST.

import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, DATA_FILE, type Plugin, runChecks, saveMeta, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import gates, { type GateDef } from "../../../naima/src/plugins/gates/index.ts"
import ui, { viewsOf } from "../../../naima/src/plugins/ui/index.ts"

const open = { category: "open" as const, says: "" }
const fixture = (): Plugin => ({
  name: "fixture",
  says: "work items and proofs",
  types: [
    { id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open }, initialStatus: "open" },
    { id: "tests", dir: "TESTS", title: "", says: "", statuses: { open, passed: { category: "done", proves: true, says: "" } }, initialStatus: "open" },
  ],
  fields: [
    { name: "fixedOn", kind: "date", says: "" },
    { name: "runBy", kind: "string", says: "" },
    { name: "humanBecause", kind: "string", says: "" },
  ],
  relations: [
    { name: "verifies", inverse: "verified-by", says: "" },
    { name: "verified-by", inverse: "verifies", says: "" },
  ],
})

const options = {
  coverage: {
    paid: { says: "the paid features", json: "plans.json", path: "plans.*.features" },
    api: { files: ["src/**/*.ts"], pattern: 'route\\("([^"]+)"' },
  },
  gates: { launch: { title: "Launch", coverage: ["paid"] } },
}

const project = () => {
  const p = tempProject([fixture(), gates(options), ui()])
  writeFileSync(join(p.ctx.root, "plans.json"), JSON.stringify({ plans: [{ features: [{ id: "export" }, { id: "sso" }] }, { features: ["audit"] }] }))
  mkdirSync(join(p.ctx.root, "src", "api"), { recursive: true })
  writeFileSync(join(p.ctx.root, "src", "api", "routes.ts"), 'route("/users")\nroute("/orders")\n')
  return p
}

const findings = (r: { problems: { message: string }[]; notes: { message: string }[] }) => [
  ...r.problems.map((x) => ({ level: "problem", message: x.message })),
  ...r.notes.map((x) => ({ level: "note", message: x.message })),
]

const proof = (p: ReturnType<typeof project>, title: string, covers: string, type = "tests") => {
  const i = createItem(p.ctx, typeOrThrow(p.ctx, type), title)
  saveMeta(p.ctx, { ...i, meta: { ...i.meta, covers: covers.split(",") } })
}

test("naima coverage prints every entry with its test or NO TEST, and --check exits 1 on NO TEST", async () => {
  const p = project()
  try {
    proof(p, "Export works", "export,paid:audit")
    proof(p, "Users listed", "api:/users")
    proof(p, "Not a test", "sso", "bugs") // only a proving item covers an entry
    p.output.length = 0
    assert.equal(await p.run("coverage"), 0)
    const out = p.output.join("\n")
    assert.match(out, /^paid — the paid features: 2 of 3 covered$/m)
    assert.match(out, /^ {2}export +tests\/export-works \[open\]$/m)
    assert.match(out, /^ {2}sso +NO TEST$/m)
    assert.match(out, /^ {2}audit +tests\/export-works \[open\]$/m)
    assert.match(out, /^api: 1 of 2 covered$/m)
    assert.match(out, /^ {2}\/orders +NO TEST$/m)
    assert.equal(await p.run("coverage", "--check"), 1)
    assert.equal(await p.run("coverage", "paid", "--check"), 1)

    proof(p, "SSO signs in", "sso")
    assert.equal(await p.run("coverage", "paid", "--check"), 0)

    // The list is read from its source on every run, never copied: a new entry shows at once.
    writeFileSync(join(p.ctx.root, "plans.json"), JSON.stringify({ plans: [{ features: [{ id: "export" }, { id: "sso" }, { id: "billing" }] }] }))
    p.output.length = 0
    assert.equal(await p.run("coverage", "paid", "--check"), 1)
    assert.match(p.output.join("\n"), /^ {2}billing +NO TEST$/m)

    p.output.length = 0
    assert.equal(await p.run("coverage", "--json", "paid"), 0)
    const data = JSON.parse(p.output.join("\n")) as { list: string; entries: { entry: string; tests: string[] }[] }[]
    assert.deepEqual(data[0]?.entries.map((e) => [e.entry, e.tests.length]), [["export", 1], ["sso", 1], ["billing", 0]])

    const view = viewsOf(p.ctx).find((v) => v.name === "coverage")
    assert.ok(view, "coverage is a tab of naima ui")
    assert.match((await view.render({}, p.ctx)).html, /billing<\/td><td class="no">NO TEST/)
  } finally {
    p.cleanup()
  }
})

test("a gate can require a list's coverage: every NO TEST blocks it, by name", async () => {
  const p = project()
  try {
    const gate = p.ctx.registry.find<GateDef>("gates", "launch")!.value
    const r = await gate.evaluate(p.ctx)
    assert.equal(r.holds, false)
    assert.deepEqual(r.reasons, ["coverage paid: export has NO TEST", "coverage paid: sso has NO TEST", "coverage paid: audit has NO TEST"])
    proof(p, "All paid", "export,sso,audit")
    assert.equal((await gate.evaluate(p.ctx)).holds, true)
    // naima gate new writes the requirement, validated against the lists naima.json declares.
    await assert.rejects(p.run("gate", "new", "ga", "General availability", "--coverage", "api"), /coverage names no list "api"/)
    const file = join(p.ctx.trackerRoot, DATA_FILE)
    const raw = JSON.parse(readFileSync(file, "utf8"))
    writeFileSync(file, JSON.stringify({ ...raw, plugins: { ...raw.plugins, gates: { options: { coverage: options.coverage } } } }))
    assert.equal(await p.run("gate", "new", "ga", "General availability", "--coverage", "api"), 0)
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")).plugins.gates.options.gates.ga, { title: "General availability", coverage: ["api"] })
  } finally {
    p.cleanup()
  }
})

test("a test naming an entry no list has is a note; a list whose source cannot be read is a problem", async () => {
  const p = project()
  try {
    proof(p, "Stale", "paid:gone")
    writeFileSync(join(p.ctx.root, "plans.json"), "{ not json")
    const f = findings(await runChecks(p.ctx)).map((x) => `${x.level}: ${x.message}`)
    assert.ok(f.some((m) => /^problem: coverage paid: plans\.json is not JSON/.test(m)), f.join("\n"))
    writeFileSync(join(p.ctx.root, "plans.json"), JSON.stringify({ plans: [] }))
    const g = findings(await runChecks(p.ctx)).map((x) => `${x.level}: ${x.message}`)
    assert.ok(g.some((m) => /^note: tests\/stale covers paid:gone, which list paid does not hold/.test(m)), g.join("\n"))
  } finally {
    p.cleanup()
  }
})

test("a coverage list is configured with exactly one source, and a gate requires only a list that exists", () => {
  assert.throws(() => gates({ coverage: { x: { json: "a.json", files: ["*"], pattern: "x" } } }), /coverage "x": one source, json or files with pattern/)
  assert.throws(() => gates({ coverage: { x: { files: ["*"] } } }), /coverage "x": files needs a pattern/)
  assert.throws(() => gates({ coverage: { x: { files: ["*"], pattern: "(" } } }), /coverage "x": pattern is not a regular expression/)
  assert.throws(() => gates({ gates: { g: { title: "G", coverage: ["nope"] } } }), /gate "g": coverage names no list "nope"/)
})
