import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import {
  addLink,
  buildRegistry,
  createContext,
  createItem,
  DEFAULT_DATA,
  DEFAULT_PROGRAM,
  fieldError,
  findData,
  FORMAT,
  moveItem,
  parseConfig,
  parseFieldValue,
  type Plugin,
  rendered,
  runChecks,
  setFields,
  slugify,
  uniqueSlug,
} from "./internal.ts"
import { corePlugin } from "./base.ts"
import { gitIn, tempProject } from "./testing.ts"

const notes: Plugin = {
  name: "notes",
  says: "a minimal item type for testing the core",
  types: [
    {
      id: "notes",
      dir: "NOTES",
      title: "Notes",
      says: "a note",
      statuses: { open: { category: "open", says: "open" }, done: { category: "done", proves: true, says: "done" } },
      initialStatus: "open",
    },
  ],
  fields: [{ name: "size", kind: "enum", says: "size", values: { S: "small", L: "large" } }],
}

const messages = (r: { problems: { message: string }[] }) => r.problems.map((p) => p.message).join("\n")

test("slugs are readable, bounded and unique", () => {
  assert.equal(slugify("The export drops the Alpha channel!"), "export-drops-alpha-channel")
  assert.equal(slugify("???"), "item")
  assert.equal(uniqueSlug("a", new Set(["a", "a-2"])), "a-3")
})

test("the registry refuses a name declared twice", () => {
  assert.throws(() => buildRegistry([corePlugin, notes, { ...notes, name: "other" }]), /type "notes" is declared by both/)
  assert.throws(() => buildRegistry([corePlugin, { name: "x", says: "", relations: [{ name: "r", inverse: "q", says: "" }] }]), /inverse "q"/)
  assert.throws(
    () => buildRegistry([corePlugin, { name: "x", says: "", fields: [{ name: "f", kind: "string", says: "", appliesTo: ["nope"] }] }]),
    /no plugin declares/,
  )
})

const LOCK = { source: "https://example.invalid/naima.git", commit: "a".repeat(40) }

test("naima.json: the formats, the lock, and the plugins table — options, enabled, source, replacedBy, check severities", () => {
  assert.deepEqual(parseConfig({ format: FORMAT, ...LOCK }), {
    format: FORMAT,
    formats: {},
    ...LOCK,
    carry: "clone",
    program: "../naima",
    plugins: {},
    rename: {},
    extends: [],
  })
  const c = parseConfig({
    format: FORMAT,
    ...LOCK,
    carry: "vendored",
    plugins: {
      gates: { options: { gates: { v1: { title: "One" } } } },
      "beta-markers": { enabled: false },
      trackers: { replacedBy: "plugins/my-trackers.ts" },
      mine: { source: "plugins/mine.ts", options: { k: 1 }, checks: { strict: "note" } },
    },
  })
  assert.equal(c.carry, "vendored")
  assert.deepEqual(c.plugins, {
    gates: { enabled: true, options: { gates: { v1: { title: "One" } } }, checks: {} },
    "beta-markers": { enabled: false, options: {}, checks: {} },
    trackers: { enabled: true, options: {}, replacedBy: "plugins/my-trackers.ts", checks: {} },
    mine: { enabled: true, options: { k: 1 }, source: "plugins/mine.ts", checks: { strict: "note" } },
  })
  assert.throws(() => parseConfig({ ...LOCK }), /has no format/)
  assert.throws(() => parseConfig({ format: FORMAT, source: "", commit: LOCK.commit }), /source must be/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, commit: "abc" }), /commit must be the full hash/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, carry: "zip" }), /carry must be one of: clone, vendored, submodule/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, naima: "^0.2.0" }), /unknown key "naima"/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, gates: {} }), /unknown key "gates"/, "gates are the gates plugin's options now")
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, plugins: ["plugins/a.ts"] }), /plugins maps a plugin's name/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, plugins: { Mine: {} } }), /lowercase letters/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, plugins: { mine: { enable: false } } }), /unknown key "enable"/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, plugins: { mine: { checks: { x: "warn" } } } }), /checks\.x must be off, note or problem/)
  assert.throws(() => parseConfig({ format: FORMAT, ...LOCK, plugins: { mine: { source: "a.ts", replacedBy: "b.ts" } } }), /not both/)
  assert.deepEqual(parseConfig({ format: FORMAT, formats: { gates: 2 }, ...LOCK }).formats, { gates: 2 })
  assert.throws(() => parseConfig({ format: FORMAT, formats: { gates: 0 }, ...LOCK }), /formats\.gates must be a format/)
})

test("the data directory: --data or NAIMA_DATA, else the first naima-tracker/naima-data/ walking up", () => {
  const p = tempProject([])
  try {
    const deep = join(p.root, "a", "b")
    mkdirSync(deep, { recursive: true })
    assert.equal(findData(deep), join(p.root, "naima-tracker", "naima-data"))
    assert.equal(findData(deep, "../../elsewhere"), join(p.root, "elsewhere"))
    assert.equal(findData(dirname(p.root)), null)
  } finally {
    p.cleanup()
  }
})

test("an item is a directory with a uuid, and links are resolved in both directions", async () => {
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    const a = createItem(p.ctx, type, "First note")
    const b = createItem(p.ctx, type, "First note")
    assert.equal(b.slug, "first-note-2")
    assert.match(readFileSync(join(a.dir, "README.md"), "utf8"), /First note/)
    addLink(p.ctx, p.ctx.repo.resolve(a.meta.id), "blocks", p.ctx.repo.resolve(b.meta.id))
    const back = p.ctx.repo.linksOf(p.ctx.repo.resolve("first-note-2"))
    assert.deepEqual(back, [{ rel: "blocked-by", id: a.meta.id, implied: true }])
    assert.throws(() => p.ctx.repo.resolve("first"), /ambiguous/)
    assert.equal((await runChecks(p.ctx)).problems.length, 0, messages(await runChecks(p.ctx)))
    assert.match((await runChecks(p.ctx)).notes.map((n) => n.message).join(), /possible duplicates/)
  } finally {
    p.cleanup()
  }
})

test("check reports every broken invariant instead of crashing", async () => {
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    const a = createItem(p.ctx, type, "One")
    const b = createItem(p.ctx, type, "Two")
    const meta = JSON.parse(readFileSync(join(b.dir, "meta.json"), "utf8"))
    Object.assign(meta, { id: a.meta.id, status: "weird", size: "XXL", links: [{ rel: "nope", id: "missing" }, "junk"] })
    writeFileSync(join(b.dir, "meta.json"), JSON.stringify(meta))
    mkdirSync(join(p.ctx.trackerRoot, "NOTES", "broken"))
    writeFileSync(join(p.ctx.trackerRoot, "NOTES", "broken", "meta.json"), "{ not json")
    mkdirSync(join(p.ctx.trackerRoot, "STRAY"))
    p.ctx.reload()
    const report = await runChecks(p.ctx)
    const text = messages(report)
    for (
      const expected of [
        /shares its id/,
        /status "weird"/,
        /size "XXL"/,
        /relation "nope"/,
        /which is no item/,
        /malformed link/,
        /broken: meta.json is not a JSON object/,
      ]
    ) {
      assert.match(text, expected)
    }
    assert.match(text, /STRAY\/ belongs to no loaded type or plugin/)
  } finally {
    p.cleanup()
  }
})

test("set validates against the field's declaration", () => {
  const p = tempProject([notes])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("notes")!, "One")
    setFields(p.ctx, item, [["size", "L"], ["tags", "a, b"], ["status", "done"]])
    assert.deepEqual([item.meta["size"], item.meta["tags"], item.meta.status], ["L", ["a", "b"], "done"])
    assert.throws(() => setFields(p.ctx, item, [["size", "M"]]), /not one of: S, L/)
    assert.throws(() => setFields(p.ctx, item, [["colour", "red"]]), /not a field/)
    setFields(p.ctx, item, [["size", ""]])
    assert.equal(item.meta["size"], undefined)
  } finally {
    p.cleanup()
  }
})

test("board and summary are derived from the items", async () => {
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    createItem(p.ctx, type, "Alpha", { section: "Later" })
    createItem(p.ctx, type, "Beta")
    assert.equal(await p.run("board", "notes"), 0)
    const out = p.output.join("\n")
    assert.match(out, /2 open, 0 done/)
    assert.ok(out.indexOf("## Later") < out.indexOf("## (no section)"))
    p.output.length = 0
    await p.run("summary")
    assert.match(p.output.join("\n"), /notes\s+2 open\s+0 done/)
  } finally {
    p.cleanup()
  }
})

test("a status is only one the type declares itself, never an Object.prototype key", async () => {
  const p = tempProject([notes])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("notes")!, "One")
    for (const status of ["__proto__", "constructor", "toString"]) {
      assert.throws(() => setFields(p.ctx, item, [["status", status]]), /is not one of: open, done/)
    }
    const meta = JSON.parse(readFileSync(join(item.dir, "meta.json"), "utf8"))
    writeFileSync(join(item.dir, "meta.json"), JSON.stringify({ ...meta, status: "constructor" }))
    p.ctx.reload()
    assert.match(messages(await runChecks(p.ctx)), /status "constructor" is not one of/)
    assert.throws(() => buildRegistry([corePlugin, { ...notes, types: [{ ...notes.types![0]!, initialStatus: "toString" }] }]), /initial status "toString"/)
  } finally {
    p.cleanup()
  }
})

test("a date field holds only a real calendar date", async () => {
  const date = { name: "due", kind: "date" as const, says: "" }
  for (const ok of ["2024", "2024-02", "2024-02-29", "2000-02-29", "2023-12-31"]) assert.equal(fieldError(date, ok), null, ok)
  for (const bad of ["2024-13-99", "2024-00", "2024-13", "2023-02-29", "2024-04-31", "2024-01-00", "1900-02-29"]) {
    assert.match(fieldError(date, bad) ?? "", /is not a date/, bad)
  }
  const p = tempProject([notes])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("notes")!, "One")
    assert.throws(() => setFields(p.ctx, item, [["created", "2024-13-99"]]), /is not a date/)
    const meta = JSON.parse(readFileSync(join(item.dir, "meta.json"), "utf8"))
    writeFileSync(join(item.dir, "meta.json"), JSON.stringify({ ...meta, created: "2024-13-99" }))
    p.ctx.reload()
    assert.match(messages(await runChecks(p.ctx)), /created "2024-13-99" is not a date/)
  } finally {
    p.cleanup()
  }
})

test("non-Latin titles keep their letters: distinct slugs, and no false duplicates", async () => {
  assert.equal(slugify("Café au lait"), "cafe-au-lait")
  assert.equal(slugify("Экспорт теряет альфа-канал"), "экспорт-теряет-альфа-канал")
  assert.equal(slugify("导出丢失透明通道"), "导出丢失透明通道")
  assert.equal(slugify("がぎぐ"), "がぎぐ")
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    const a = createItem(p.ctx, type, "Экспорт теряет альфа-канал")
    const b = createItem(p.ctx, type, "Импорт падает")
    const c = createItem(p.ctx, type, "导出丢失透明通道")
    assert.equal(new Set([a.slug, b.slug, c.slug]).size, 3)
    assert.doesNotMatch((await runChecks(p.ctx)).notes.map((n) => n.message).join(), /possible duplicates/)
    createItem(p.ctx, type, "ЭКСПОРТ теряет альфа канал")
    assert.match((await runChecks(p.ctx)).notes.map((n) => n.message).join(), /possible duplicates/)
  } finally {
    p.cleanup()
  }
})

test("new never reuses a directory: a slug taken in another case, or by a concurrent run, is suffixed", async () => {
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    const first = createItem(p.ctx, type, "Crash save")
    const upper = join(p.ctx.trackerRoot, "NOTES", "Crash-Save-2")
    mkdirSync(upper)
    writeFileSync(join(upper, "meta.json"), JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", title: "Crash-Save", status: "open" }))
    assert.equal(uniqueSlug("crash-save-2", new Set(["Crash-Save-2"])), "crash-save-2-2")
    const second = createItem(p.ctx, type, "Crash save")
    assert.equal(second.slug, "crash-save-3")
    assert.equal(JSON.parse(readFileSync(join(upper, "meta.json"), "utf8")).id, "11111111-1111-4111-8111-111111111111")
    assert.equal(p.ctx.repo.resolve(first.meta.id).slug, "crash-save")

    // Eight processes open the same title at once: eight items, eight directories.
    const cli = join(dirname(dirname(fileURLToPath(import.meta.url))), "cli.ts")
    const runs = Array.from(
      { length: 8 },
      () =>
        new Promise<number>((done) =>
          spawn("deno", ["run", "-A", cli, "--data", p.ctx.trackerRoot, "new", "bugs", "Same title"], { stdio: "ignore" }).on("close", (c) => done(c ?? -1))
        ),
    )
    assert.deepEqual(await Promise.all(runs), Array(8).fill(0))
    const dirs = readdirSync(join(p.ctx.trackerRoot, "bugs"))
    assert.equal(dirs.length, 8)
    const ids = new Set(dirs.map((d) => JSON.parse(readFileSync(join(p.ctx.trackerRoot, "bugs", d, "meta.json"), "utf8")).id))
    assert.equal(ids.size, 8)
  } finally {
    p.cleanup()
  }
})

test("new validates every --set before it writes anything", async () => {
  const p = tempProject([notes])
  try {
    await assert.rejects(p.run("new", "notes", "Half made", "--set", "size=L", "--set", "badfield=1"), /"badfield" is not a field of notes/)
    await assert.rejects(p.run("new", "notes", "Half made", "--set", "size=XXL"), /size: "XXL" is not one of/)
    await assert.rejects(p.run("new", "notes", "Half made", "--set", "status=__proto__"), /is not one of: open, done/)
    const dir = join(p.ctx.trackerRoot, "NOTES")
    assert.deepEqual(existsSync(dir) ? readdirSync(dir) : [], [])
    assert.equal(await p.run("new", "notes", "Half made", "--set", "size=L", "--set", "status=done"), 0)
    const [item] = p.ctx.repo.items
    assert.deepEqual([item?.slug, item?.meta["size"], item?.meta.status], ["half-made", "L", "done"])
  } finally {
    p.cleanup()
  }
})

test("an empty item reference is a usage error, never the only item", async () => {
  const p = tempProject([notes])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("notes")!, "Only one")
    assert.throws(() => p.ctx.repo.resolve(""), /no item named/)
    assert.throws(() => p.ctx.repo.resolve("  "), /no item named/)
    await assert.rejects(p.run("show", ""), /usage: naima show <item>/)
    await assert.rejects(p.run("show"), /usage: naima show <item>/)
    await assert.rejects(p.run("set", "", "size=L"), /usage: naima set <item> field=value/)
    await assert.rejects(p.run("set", item.slug), /usage: naima set <item> field=value/)
    assert.equal(p.ctx.repo.resolve(item.meta.id).meta["size"], undefined)
  } finally {
    p.cleanup()
  }
})

test("a link is stored in one direction only: its inverse is already the link", async () => {
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    const a = createItem(p.ctx, type, "Alpha")
    const b = createItem(p.ctx, type, "Beta")
    const stored = () => p.ctx.repo.items.flatMap((i) => (i.meta.links ?? []).map((l) => `${i.slug} ${l.rel}`))
    assert.equal(await p.run("link", "alpha", "relates-to", "beta"), 0)
    p.output.length = 0
    assert.equal(await p.run("link", "beta", "relates-to", "alpha"), 0)
    assert.deepEqual(p.output, ["already linked"])
    assert.equal(await p.run("link", "alpha", "blocks", "beta"), 0)
    assert.equal(await p.run("link", "beta", "blocked-by", "alpha"), 0)
    p.ctx.reload()
    assert.deepEqual(stored(), ["alpha relates-to", "alpha blocks"])
    assert.equal(p.ctx.repo.linksOf(p.ctx.repo.resolve(b.meta.id)).length, 2)

    const path = join(b.dir, "meta.json")
    const meta = JSON.parse(readFileSync(path, "utf8"))
    writeFileSync(path, JSON.stringify({ ...meta, links: [{ rel: "blocked-by", id: a.meta.id }] }))
    p.ctx.reload()
    assert.match(messages(await runChecks(p.ctx)), /both directions of one link are stored/)
  } finally {
    p.cleanup()
  }
})

test("a meta.json whose id, title or status is not a string is unreadable, not a crash", async () => {
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    const good = createItem(p.ctx, type, "Good")
    for (const [title, patch] of [["Bad status", { status: 5 }], ["Bad title", { title: ["x"] }], ["Bad id", { id: 7 }]] as const) {
      const item = createItem(p.ctx, type, title)
      const meta = JSON.parse(readFileSync(join(item.dir, "meta.json"), "utf8"))
      writeFileSync(join(item.dir, "meta.json"), JSON.stringify({ ...meta, ...patch }))
    }
    p.ctx.reload()
    assert.equal(await p.run("list"), 0)
    assert.match(p.output.join("\n"), /1 item$/)
    assert.deepEqual(p.ctx.repo.items.map((i) => i.meta.id), [good.meta.id])
    const text = messages(await runChecks(p.ctx))
    assert.match(text, /bad-status: meta\.json: status is not a string/)
    assert.match(text, /bad-title: meta\.json: title is not a string/)
    assert.match(text, /bad-id: meta\.json: id is not a string/)
  } finally {
    p.cleanup()
  }
})

test("a directory check cannot read is a problem: a misspelled type, an _underscored or a symlinked item", async () => {
  const p = tempProject([notes])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("notes")!, "Real")
    mkdirSync(join(p.ctx.trackerRoot, "NOETS", "typo"), { recursive: true })
    mkdirSync(join(p.ctx.trackerRoot, "NOTES", "_draft"))
    writeFileSync(join(p.ctx.trackerRoot, "NOTES", "_draft", "meta.json"), "{}")
    symlinkSync(item.dir, join(p.ctx.trackerRoot, "NOTES", "linked"), "dir")
    p.ctx.reload()
    const text = messages(await runChecks(p.ctx))
    assert.match(text, /NOETS\/ belongs to no loaded type or plugin/)
    assert.match(text, /NOTES\/_draft: not read as an item/)
    assert.match(text, /NOTES\/linked: a symbolic link, not read as an item/)
    assert.equal(p.ctx.repo.items.length, 1)
  } finally {
    p.cleanup()
  }
})

test("a write is seen by the next read in the same run, with no reload", async () => {
  const p = tempProject([notes])
  try {
    const type = p.ctx.registry.types.get("notes")!
    createItem(p.ctx, type, "Alpha")
    createItem(p.ctx, type, "Beta")
    const cmd = (name: string, ...args: string[]) => p.ctx.registry.commands.get(name)!.run(args, p.ctx) // no reload between runs
    await cmd("link", "alpha", "blocks", "beta")
    assert.deepEqual(p.ctx.repo.linksOf(p.ctx.repo.resolve("beta")).map((l) => l.rel), ["blocked-by"])
    await cmd("unlink", "alpha", "blocks", "beta")
    assert.deepEqual(p.ctx.repo.linksOf(p.ctx.repo.resolve("beta")), [])
    await cmd("set", "beta", "size=L")
    assert.equal(p.ctx.repo.resolve("beta").meta["size"], "L")
  } finally {
    p.cleanup()
  }
})

test("a plugin cannot take a name the entry point answers; a check, summary or rank name another plugin declared is shared, by qualified id", () => {
  const cmd = (name: string) => ({ name, says: "x", usage: name, run: () => 0 })
  const reserved = ["init", "update", "carry", "guide", "help"]
  for (const name of reserved) {
    assert.throws(
      () => buildRegistry([corePlugin, { name: "p", says: "", commands: [cmd(name)] }], { reserved }),
      new RegExp(`command "${name}" is answered by the entry point`),
    )
  }
  const check = { name: "links", says: "x", run: () => [] }
  const term = { name: "t", score: () => 0 }
  const r = buildRegistry([corePlugin, {
    name: "p",
    says: "",
    checks: [check],
    summary: [{ name: "items", render: () => rendered([], () => []) }],
    rank: [term],
  }, {
    name: "q",
    says: "",
    rank: [term],
  }])
  assert.deepEqual(r.contributions("checks").filter((c) => c.name === "links").map((c) => c.id), ["core/links", "p/links"])
  assert.deepEqual(r.contributions("summary").filter((c) => c.name === "items").map((c) => c.id), ["core/items", "p/items"])
  assert.equal(r.rank.length, 2, "both terms count")
  assert.throws(() => r.find("checks", "links"), /check "links" is ambiguous: core\/links, p\/links — name one by its qualified id/)
  assert.equal(r.find("checks", "p/links")?.value, check)
  assert.throws(() => buildRegistry([{ name: "p", says: "", checks: [check, check] }]), /check "links" is declared twice by "p"/)
})

test("the registry and the config cannot be changed once the project is loaded", () => {
  const p = tempProject([notes])
  try {
    const { registry, config } = p.ctx
    const mutable = registry as unknown as { commands: Map<string, unknown>; dirs: Set<string>; checks: unknown[]; types: Map<string, unknown> }
    assert.throws(() => mutable.commands.delete("show"), /registry is read-only/)
    assert.throws(() => mutable.commands.set("show", {}), /registry is read-only/)
    assert.throws(() => mutable.types.clear(), /registry is read-only/)
    assert.throws(() => mutable.dirs.add("X"), /registry is read-only/)
    assert.throws(() => mutable.checks.push({}), TypeError)
    assert.throws(() => Object.assign(registry, { commands: new Map() }), TypeError)
    assert.throws(() => Object.assign(config.plugins, { v2: {} }), TypeError)
    assert.throws(() => Object.assign(config, { commit: "f".repeat(40) }), TypeError)
    assert.throws(() => Object.assign(registry.commands.get("show") as object, { run: () => 0 }), TypeError, "no plugin replaces another's command")
    assert.throws(
      () => Object.assign(registry.types.get("notes")?.statuses ?? {}, { gone: {} }),
      TypeError,
      "nor adds to another's type behind the registry's back",
    )
    assert.ok(registry.commands.has("show") && registry.types.has("notes"))
  } finally {
    p.cleanup()
  }
})

/** A small seeded generator: the same cases on every run and every runtime. */
function* cases(seed: number, n: number, alphabet: string[], maxLength = 24): Generator<string> {
  let s = seed
  const next = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  for (let i = 0; i < n; i++) yield Array.from({ length: Math.floor(next() * maxLength) }, () => alphabet[Math.floor(next() * alphabet.length)]).join("")
}

test("properties: a slug is lowercase letters, digits and single dashes, at most 60 long, and slugifying it again changes nothing", () => {
  const alphabet = [..."abcXYZ09 -_.,!?/é", "Ж", "ы", "导", "出", "が", "\t", "ﬁ", "²"]
  for (const title of cases(7, 2000, alphabet)) {
    const slug = slugify(title)
    assert.match(slug, /^(?:[\p{Ll}\p{Lo}\p{Nd}\p{No}]+(?:-[\p{Ll}\p{Lo}\p{Nd}\p{No}]+)*|item)$/u, JSON.stringify(title))
    assert.ok([...slug].length <= 60, title)
    assert.equal(slugify(slug), slug, JSON.stringify(title))
  }
})

test("properties: every value a field's kind accepts comes back from the command line as it went in", () => {
  const defs = {
    string: { name: "s", kind: "string", says: "" },
    strings: { name: "l", kind: "strings", says: "" },
    number: { name: "n", kind: "number", says: "" },
    boolean: { name: "b", kind: "boolean", says: "" },
    date: { name: "d", kind: "date", says: "" },
    object: { name: "o", kind: "object", says: "" },
  } as const
  const words = [...cases(11, 300, [..."abz09 ._"])].map((w) => w.trim()).filter((w) => w && !w.includes(","))
  for (const w of words) {
    assert.equal(parseFieldValue(defs.string, w), w)
    assert.deepEqual(parseFieldValue(defs.strings, [w, w].join(",")), [w, w])
    assert.deepEqual(parseFieldValue(defs.object, JSON.stringify({ w })), { w })
  }
  for (const n of [0, 1, -3, 2.5, 1e6]) assert.equal(parseFieldValue(defs.number, String(n)), n)
  for (const b of [true, false]) assert.equal(parseFieldValue(defs.boolean, String(b)), b)
  for (let d = new Date("2023-12-25T00:00:00Z"); d < new Date("2024-03-10T00:00:00Z"); d = new Date(d.getTime() + 86_400_000)) {
    const day = d.toISOString().slice(0, 10)
    assert.equal(parseFieldValue(defs.date, day), day)
  }
})

test("every write helper runs every plugin's beforeWrite and afterWrite, in load order, with the fields on disk before it", async () => {
  const seen: string[] = []
  const recorder = (name: string): Plugin => ({
    name,
    says: "records writes",
    hooks: [{
      name: `${name}-hook`,
      says: "records every write",
      beforeWrite: (w) => void seen.push(`${name} before ${w.kind} ${w.item.meta.title} was=${w.before?.["size"] ?? w.before?.status ?? "-"}`),
      afterWrite: (w) => void seen.push(`${name} after ${w.kind} ${w.item.type}/${w.item.slug}`),
    }],
  })
  const archive: Plugin = {
    name: "archive",
    says: "an archive to move to",
    types: [{ id: "old", dir: "OLD", title: "Old", says: "", statuses: { gone: { category: "done", says: "" } }, initialStatus: "gone", creatable: false }],
  }
  const p = tempProject([notes, archive, recorder("first"), recorder("second")])
  try {
    const { ctx } = p
    const a = createItem(ctx, ctx.registry.types.get("notes")!, "Alpha")
    const b = createItem(ctx, ctx.registry.types.get("notes")!, "Beta")
    setFields(ctx, a, [["size", "S"]])
    addLink(ctx, a, "relates-to", b)
    assert.equal(await p.run("unlink", "alpha", "relates-to", "beta"), 0)
    assert.equal(await p.run("set", "alpha", "size=L"), 0)
    moveItem(ctx, ctx.repo.resolve("beta"), ctx.registry.types.get("old")!)
    assert.deepEqual(seen, [
      "first before create Alpha was=-",
      "second before create Alpha was=-",
      "first after create notes/alpha",
      "second after create notes/alpha",
      "first before create Beta was=-",
      "second before create Beta was=-",
      "first after create notes/beta",
      "second after create notes/beta",
      ...["first", "second"].map((n) => `${n} before update Alpha was=open`),
      ...["first", "second"].map((n) => `${n} after update notes/alpha`),
      ...["first", "second"].map((n) => `${n} before update Alpha was=S`), // link
      ...["first", "second"].map((n) => `${n} after update notes/alpha`),
      ...["first", "second"].map((n) => `${n} before update Alpha was=S`), // unlink
      ...["first", "second"].map((n) => `${n} after update notes/alpha`),
      ...["first", "second"].map((n) => `${n} before update Alpha was=S`), // set size=L
      ...["first", "second"].map((n) => `${n} after update notes/alpha`),
      ...["first", "second"].map((n) => `${n} before move Beta was=open`),
      ...["first", "second"].map((n) => `${n} after move old/beta`),
    ])
  } finally {
    p.cleanup()
  }
})

test("a beforeWrite hook may change what is written, or refuse: the refusal says why, and nothing is written", async () => {
  const guard: Plugin = {
    name: "guard",
    says: "refuses large notes, and upper-cases titles",
    hooks: [
      { name: "shout", says: "upper-cases titles", beforeWrite: (w) => void (w.item.meta.title = w.item.meta.title.toUpperCase()) },
      { name: "no-large", says: "refuses size L", beforeWrite: (w) => (w.item.meta["size"] === "L" ? "large notes are not allowed — use S" : undefined) },
    ],
  }
  const p = tempProject([notes, guard])
  try {
    const { ctx } = p
    const type = ctx.registry.types.get("notes")!
    const a = createItem(ctx, type, "Alpha")
    assert.equal(JSON.parse(readFileSync(join(a.dir, "meta.json"), "utf8")).title, "ALPHA")
    assert.throws(() => createItem(ctx, type, "Big", { size: "L" }), /large notes are not allowed — use S \(refused by no-large\)/)
    assert.equal(existsSync(join(ctx.trackerRoot, "NOTES", "big")), false, "a refused create leaves no directory")
    assert.throws(() => setFields(ctx, a, [["size", "L"]]), /refused by no-large/)
    assert.equal(a.meta["size"], undefined, "a refused set leaves the item as it was, in memory")
    assert.equal(JSON.parse(readFileSync(join(a.dir, "meta.json"), "utf8")).size, undefined, "and on disk")
    await assert.rejects(p.run("set", "alpha", "size=L"), (e: Error) => e.name === "NaimaError" && /use S/.test(e.message))
  } finally {
    p.cleanup()
  }
})

test("a hook that refuses without saying why is a bug in the hook, not a refusal", () => {
  const mute: Plugin = { name: "mute", says: "refuses silently", hooks: [{ name: "mute", says: "refuses everything", beforeWrite: () => "  " }] }
  const p = tempProject([notes, mute])
  try {
    assert.throws(
      () => createItem(p.ctx, p.ctx.registry.types.get("notes")!, "Alpha"),
      (e: Error) => e instanceof TypeError && /without saying why/.test(e.message),
    )
  } finally {
    p.cleanup()
  }
})

test("a write hook's name is qualified: two plugins' hooks by one name both run, and are told apart by id", () => {
  const hook = { name: "same", says: "x" }
  const r = buildRegistry([{ name: "a", says: "a", hooks: [hook] }, { name: "b", says: "b", hooks: [hook] }])
  assert.equal(r.hooks.length, 2)
  assert.deepEqual(r.contributions("hooks").map((c) => c.id), ["a/same", "b/same"])
  assert.throws(() => buildRegistry([{ name: "a", says: "a", hooks: [hook, hook] }]), /write hook "same" is declared twice by "a"/)
})

test("two branches that open an item with one title take two slugs, and merge without a conflict", () => {
  const p = tempProject([notes], { git: true })
  const wb = `${p.root}-b`
  try {
    const type = p.ctx.registry.types.get("notes")!
    p.git("worktree", "add", "-q", "-b", "b", wb)
    p.git("checkout", "-q", "-b", "a")
    assert.equal(createItem(p.ctx, type, "Same title").slug, "same-title")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "a")
    const onB = createContext({ root: wb, data: join(wb, DEFAULT_DATA), program: join(wb, DEFAULT_DATA, DEFAULT_PROGRAM) }, p.ctx.config, p.ctx.registry)
    assert.equal(createItem(onB, type, "Same title").slug, "same-title-2", "a is not merged, and its slug is seen from b")
    // Not yet committed on b: seen from a third branch through b's worktree.
    p.git("checkout", "-q", "-b", "c", "main")
    assert.equal(createItem(p.ctx, type, "Same title").slug, "same-title-3")
    gitIn(wb, "add", "-A")
    gitIn(wb, "commit", "-q", "-m", "b")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "c")
    p.git("checkout", "-q", "main")
    p.git("merge", "-q", "--no-edit", "a", "b", "c")
    assert.deepEqual(readdirSync(join(p.ctx.trackerRoot, "NOTES")).sort(), ["same-title", "same-title-2", "same-title-3"])
  } finally {
    p.cleanup()
    rmSync(wb, { recursive: true, force: true })
  }
})

test("when the other branches cannot be read — a shallow clone — a new slug ends in its uuid's first eight characters", () => {
  const p = tempProject([notes], { git: true })
  const shallow = `${p.root}-shallow`
  try {
    p.git("commit", "-q", "--allow-empty", "-m", "two")
    gitIn(p.root, "clone", "-q", "--depth", "1", `file://${p.root}`, shallow)
    const ctx = createContext(
      { root: shallow, data: join(shallow, DEFAULT_DATA), program: join(shallow, DEFAULT_DATA, DEFAULT_PROGRAM) },
      p.ctx.config,
      p.ctx.registry,
    )
    const item = createItem(ctx, p.ctx.registry.types.get("notes")!, "Same title")
    assert.equal(item.slug, `same-title-${item.meta.id.slice(0, 8)}`)
    assert.equal(createItem(p.ctx, p.ctx.registry.types.get("notes")!, "Same title").slug, "same-title", "a full clone reads its branches")
  } finally {
    p.cleanup()
    rmSync(shallow, { recursive: true, force: true })
  }
})

test("a contribution names each program it runs by one word or an absolute path, which the launcher can pass to Deno", () => {
  const tools = (runs: unknown[]): Plugin => ({
    name: "v",
    says: "v",
    points: [{ id: "tools", noun: "tool", says: "a tool", key: (t: { id: string }) => t.id }],
    contributes: { tools: [{ id: "checker", runs }] },
  })
  for (const bad of ["tlc,java", "two words", ""]) {
    assert.throws(() => buildRegistry([tools([bad])]), /runs .*one word or an absolute path/, bad)
  }
  assert.deepEqual((buildRegistry([tools(["tlc", "/usr/bin/java"])]).find("tools", "checker")?.value as { runs: string[] }).runs, ["tlc", "/usr/bin/java"])
})
