// Forward-only, deterministic migration, the core's and each plugin's own,
// and the refusals around it. The migrations here are fixtures: the mechanism
// must hold whatever the shipped ones are.

import assert from "node:assert/strict"
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { test } from "node:test"
import {
  buildRegistry,
  createItem,
  FORMAT,
  formatCheck,
  formatRefusal,
  migrate,
  type Migration,
  MIGRATIONS,
  openProject,
  type Plugin,
  runChecks,
} from "../../naima/src/core/internal.ts"
import { tempProject } from "./testing.ts"

/** Format 1 → 2 renames the item field `area` to `where`; 2 → 3 adds `carry` to naima.json. */
const fixture: Migration[] = [
  {
    from: 1,
    says: "area became where",
    item: ({ area, ...rest }) => (area === undefined ? rest : { ...rest, where: area }),
    stale: (meta) => "area" in meta,
  },
  { from: 2, says: "naima.json names its carry", config: (raw) => ({ ...raw, carry: raw["carry"] ?? "clone" }) },
]

function files(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const path = join(d, name)
      if (statSync(path).isDirectory()) walk(path)
      else out[relative(dir, path)] = readFileSync(path, "utf8")
    }
  }
  walk(dir)
  return out
}

function formatOneData(): string {
  const data = mkdtempSync(join(tmpdir(), "naima-format-"))
  writeFileSync(join(data, "naima.json"), `{"source":"s","format":1,"commit":"${"a".repeat(40)}","gates":{}}`)
  for (
    const [slug, meta] of [
      ["alpha", { title: "Alpha", id: "1", status: "open", area: "export" }],
      ["beta", { id: "2", title: "Beta", status: "open" }],
    ] as const
  ) {
    mkdirSync(join(data, "bugs", slug), { recursive: true })
    writeFileSync(join(data, "bugs", slug, "meta.json"), JSON.stringify(meta))
  }
  return data
}

test("this Naima reads format 1 + the number of migrations it carries", () => {
  assert.equal(FORMAT, 1 + MIGRATIONS.length)
  assert.equal(formatRefusal(FORMAT), null)
})

test("migration is forward only and deterministic: the same input gives byte-identical output, and again changes nothing", () => {
  const one = formatOneData()
  const two = mkdtempSync(join(tmpdir(), "naima-format-"))
  try {
    cpSync(one, two, { recursive: true })
    const steps = [{ plugin: null, from: 1, says: "area became where" }, { plugin: null, from: 2, says: "naima.json names its carry" }]
    assert.deepEqual(migrate(one, fixture), steps)
    assert.deepEqual(migrate(two, fixture), steps)
    const after = files(one)
    assert.deepEqual(files(two), after, "byte-identical")
    assert.deepEqual(JSON.parse(after["naima.json"] ?? ""), { format: 3, source: "s", commit: "a".repeat(40), gates: {}, carry: "clone" })
    assert.equal(after[join("bugs", "alpha", "meta.json")], JSON.stringify({ title: "Alpha", id: "1", status: "open", where: "export" }, null, 2) + "\n")
    assert.deepEqual(migrate(one, fixture), [], "idempotent")
    assert.deepEqual(files(one), after)
  } finally {
    rmSync(one, { recursive: true, force: true })
    rmSync(two, { recursive: true, force: true })
  }
})

test("newer data is refused and left as it was; a migration that throws writes nothing", () => {
  const data = formatOneData()
  try {
    const before = files(data)
    writeFileSync(join(data, "naima.json"), JSON.stringify({ format: 4 }))
    assert.throws(
      () => migrate(data, fixture),
      /^Error: naima\.json is format 4, newer than the format 3 this Naima reads — it was written by a newer Naima: record that Naima's commit$/,
    )
    writeFileSync(join(data, "naima.json"), before["naima.json"] ?? "")
    const broken: Migration[] = [fixture[0] as Migration, {
      from: 2,
      says: "throws",
      config: () => {
        throw new Error("boom")
      },
    }]
    assert.throws(() => migrate(data, broken), /boom/)
    assert.deepEqual(files(data), before)
    assert.throws(() => migrate(data, [{ from: 2, says: "gap" }]), /no gap/)
  } finally {
    rmSync(data, { recursive: true, force: true })
  }
})

test("check fails on a tracker that mixes formats", async () => {
  const p = tempProject([{ name: "mixed", says: "the fixture's format check", checks: [{ ...formatCheck(fixture), name: "one-format-fixture" }] }, {
    name: "bugs",
    says: "a type",
    types: [{ id: "bugs", dir: "bugs", title: "Bugs", says: "bugs", statuses: { open: { category: "open", says: "open" } }, initialStatus: "open" }],
  }])
  try {
    const type = p.ctx.registry.types.get("bugs")!
    createItem(p.ctx, type, "Migrated", { where: "export" })
    assert.equal((await runChecks(p.ctx)).problems.length, 0)
    createItem(p.ctx, type, "Merged from an old branch", { area: "export" })
    assert.deepEqual(
      (await runChecks(p.ctx)).problems.map((f) => f.message),
      ["bugs/merged-from-old-branch is still in format 1 (area became where) — naima update migrates it"],
    )
  } finally {
    p.cleanup()
  }
})

/** A plugin whose format 1 → 2 moves its setting `oldKey` to its own options, and 2 → 3 renames its field `size` to `bytes`. */
const moving = (steps = 2): Plugin => ({
  name: "mover",
  says: "a plugin whose data moves",
  migrations: ([
    {
      from: 1,
      says: "oldKey moved",
      config: ({ oldKey, ...rest }) => (oldKey === undefined ? rest : { ...rest, plugins: { mover: { options: { key: oldKey } } } }),
    },
    { from: 2, says: "size became bytes", item: ({ size, ...rest }) => (size === undefined ? rest : { ...rest, bytes: size }), stale: (m) => "size" in m },
  ] satisfies Migration[]).slice(0, steps),
})

test("a plugin's own migrations run after the core's and record its format in formats, deterministically and once", () => {
  const data = formatOneData()
  try {
    const plugin = moving()
    writeFileSync(join(data, "naima.json"), `{"format":1,"source":"s","commit":"${"a".repeat(40)}","oldKey":{"x":1}}`)
    writeFileSync(join(data, "bugs", "beta", "meta.json"), JSON.stringify({ id: "2", title: "Beta", status: "open", size: 3 }))
    const steps = migrate(data, fixture, [{ plugin: "mover", migrations: plugin.migrations ?? [] }])
    assert.deepEqual(steps.map((s) => `${s.plugin ?? "core"} ${s.from}`), ["core 1", "core 2", "mover 1", "mover 2"])
    const after = files(data)
    assert.equal(
      after["naima.json"],
      JSON.stringify(
        { format: 3, formats: { mover: 3 }, source: "s", commit: "a".repeat(40), carry: "clone", plugins: { mover: { options: { key: { x: 1 } } } } },
        null,
        2,
      ) + "\n",
    )
    assert.deepEqual(JSON.parse(after[join("bugs", "beta", "meta.json")] ?? ""), { id: "2", title: "Beta", status: "open", bytes: 3 })
    assert.deepEqual(migrate(data, fixture, [{ plugin: "mover", migrations: plugin.migrations ?? [] }]), [], "idempotent")
    assert.deepEqual(files(data), after)
    // Data a newer mover wrote is refused, and left as it was.
    assert.throws(
      () => migrate(data, fixture, [{ plugin: "mover", migrations: moving(1).migrations ?? [] }]),
      /is mover format 3, newer than the mover format 2/,
    )
    assert.deepEqual(files(data), after)
  } finally {
    rmSync(data, { recursive: true, force: true })
  }
})

test("a plugin's migrations go 1, 2, 3 with no gap: the registry refuses a plugin that skips one", () => {
  assert.throws(() => buildRegistry([{ name: "gappy", says: "skips", migrations: [{ from: 2, says: "gap" }] }]), /plugin "gappy": migration 1 reads format 2/)
})

test("check fails on an item still in the shape a plugin's migration replaced", async () => {
  const p = tempProject([moving(), {
    name: "bugs",
    says: "a type",
    types: [{ id: "bugs", dir: "bugs", title: "Bugs", says: "bugs", statuses: { open: { category: "open", says: "open" } }, initialStatus: "open" }],
  }])
  try {
    createItem(p.ctx, p.ctx.registry.types.get("bugs")!, "Merged from an old branch", { size: 3 })
    assert.deepEqual((await runChecks(p.ctx)).problems.map((f) => f.message), [
      "bugs/merged-from-old-branch is still in mover format 2 (size became bytes) — naima update migrates it",
    ])
  } finally {
    p.cleanup()
  }
})

test("data that owes a plugin's migration: the launched program refuses it, the development build reads it migrated in memory, and writes nothing", async () => {
  const p = tempProject([])
  const data = join(p.root, "naima-tracker", "naima-data")
  const raw = JSON.parse(readFileSync(join(data, "naima.json"), "utf8"))
  const place = { root: p.root, data, program: join(p.root, "naima-tracker", "naima") }
  try {
    writeFileSync(join(data, "naima.json"), JSON.stringify({ ...raw, oldKey: {} }))
    const before = files(data)
    const errors: string[] = []
    const io = { out: () => {}, err: (l: string) => void errors.push(l), now: () => new Date() }
    const opts = (plugin: Plugin, launched: boolean) => ({ programRoot: place.program, firstParty: [{ name: plugin.name, factory: () => plugin }], launched })
    await assert.rejects(
      openProject(place, opts(moving(1), true), io),
      /naima\.json is mover format 1, older than the mover format 2 this Naima's mover reads — naima update migrates it/,
    )
    const ctx = await openProject(place, opts(moving(1), false), io)
    assert.equal(ctx.config.formats["mover"], 2)
    assert.match(errors.join("\n"), /the data owes mover format 1 \(oldKey moved\) — read as migrated, in memory/)
    // A migration that rewrites items is not read in memory: the development build refuses it too.
    await assert.rejects(openProject(place, opts(moving(2), false), io), /only when its migrations change naima\.json alone/)
    assert.deepEqual(files(data), before, "nothing written")
  } finally {
    p.cleanup()
  }
})
