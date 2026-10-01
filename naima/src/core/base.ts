// The core's own contributions, declared through the same contract as any
// plugin: the generic fields and relations, the invariants, and the commands
// that work on any item type.

import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { bool, pairs, parse, str, strs, usageError } from "./args.ts"
import { coreChecks, runChecks } from "./check.ts"
import { groupBy } from "./collections.ts"
import { appliesTo, fieldValue, parseFieldValue } from "./fields.ts"
import { ATTACHMENTS, createItem, readReadme, saveMeta, type WriteOptions } from "./item.ts"
import { byUrgency, isOpen, label } from "./lifecycle.ts"
import { CONTRACT } from "./contract.ts"
import { shortOrId } from "./names.ts"
import { asRendered, type Format, linesAs, rendered } from "./rendered.ts"
import { flagsOf } from "./vocabulary.ts"
import type { Command, Context, Contribution, Item, Plugin, SummarySection, TypeDef, View, WriteHook } from "./types.ts"

export function typeOrThrow(ctx: Context, id: string | undefined): TypeDef {
  const type = id ? ctx.registry.types.get(id) : undefined
  if (!type) throw new Error(`unknown type ${JSON.stringify(id)} — types: ${[...ctx.registry.types.keys()].join(", ")}`)
  return type
}

/**
 * The fields `field=value` pairs give an item of `type`, validated against the
 * registry, applied to a copy of `meta`. Throws on the first invalid pair and
 * writes nothing, so a caller can validate before anything exists on disk.
 */
export function withFields<M extends Record<string, unknown>>(ctx: Context, type: string, meta: M, assignments: [string, string][]): M {
  const next: Record<string, unknown> = { ...meta }
  for (const [name, raw] of assignments) {
    if (name === "status") {
      const statuses = ctx.registry.types.get(type)?.statuses ?? {}
      if (!Object.hasOwn(statuses, raw)) throw new Error(`status "${raw}" is not one of: ${Object.keys(statuses).join(", ")}`)
      next["status"] = raw
      continue
    }
    if (name === "title") {
      if (!raw.trim()) throw new Error("title cannot be empty")
      next["title"] = raw
      continue
    }
    const def = ctx.registry.fields.get(name)
    if (!def || !appliesTo(def, type)) {
      const known = [...ctx.registry.fields.values()].filter((f) => appliesTo(f, type)).map((f) => f.name)
      throw new Error(`"${name}" is not a field of ${type} — fields: status, title, ${known.join(", ")}`)
    }
    if (raw === "") delete next[name]
    else next[name] = parseFieldValue(def, raw)
  }
  return next as M
}

/**
 * Set `field=value` pairs on an item, validated against the registry, through
 * every plugin's write hooks; nothing is written, and `item` is left as it
 * was, unless every pair is valid and no hook refuses.
 */
export function setFields(ctx: Context, item: Item, assignments: [string, string][], opts: WriteOptions = {}): void {
  const next: Item = { ...item, meta: withFields(ctx, item.type, item.meta, assignments) }
  saveMeta(ctx, next, opts)
  item.meta = next.meta
}

export function addLink(ctx: Context, from: Item, rel: string, to: Item): boolean {
  if (!ctx.registry.relations.has(rel)) throw new Error(`relation "${rel}" is not one of: ${[...ctx.registry.relations.keys()].join(", ")}`)
  if (from.meta.id === to.meta.id) throw new Error("an item cannot link to itself")
  // Stored here, or stored on `to` as the inverse: either way the link already exists.
  if (ctx.repo.linksOf(from).some((l) => l.rel === rel && l.id === to.meta.id)) return false
  const next: Item = { ...from, meta: { ...from.meta, links: [...(from.meta.links ?? []), { rel, id: to.meta.id }] } }
  saveMeta(ctx, next)
  from.meta = next.meta
  return true
}

const SECTION = { name: "section", kind: "string" } as const

const line = (item: Item): string => `  ${item.meta.status.padEnd(9)} ${item.meta.title}  — ${label(item)}`

const newCommand: Command = {
  name: "new",
  says: "open an item",
  usage: 'new <type> "<title>" [--section <s>] [--set field=value]...',
  options: [
    { name: "--section", says: "the heading the item is grouped under on its board" },
    { name: "--set", says: "a field=value pair to set on the new item; repeatable" },
  ],
  examples: ['new bugs "Export drops the alpha channel"', 'new tests "Export keeps the alpha channel" --set runBy=agent --section export'],
  run(args, ctx) {
    const p = parse(args, { section: { type: "string" }, set: { type: "string", multiple: true } })
    const [typeId, title] = p.positionals
    const type = typeOrThrow(ctx, typeId)
    if (type.creatable === false) throw new Error(`${type.id} is an archive: items arrive by being moved there, not by being opened`)
    if (!title?.trim()) throw usageError(this)
    const section = str(p, "section")
    // Every assignment is validated before the item exists: a typo leaves nothing behind.
    const fields = withFields(ctx, type.id, section ? { section } : {}, pairs(strs(p, "set")))
    const item = createItem(ctx, type, title.trim(), fields)
    ctx.out(`${ctx.trackerDir}/${type.dir}/${item.slug}/  ${item.meta.id}`)
    return 0
  },
}

const show: Command = {
  name: "show",
  says: "print one item: fields, links in both directions, attachments, prose",
  usage: "show <item>",
  examples: ["show export-drops", "show bugs/export-drops-alpha-channel"],
  run(args, ctx) {
    const ref = parse(args).positionals[0]
    if (!ref?.trim()) throw usageError(this)
    const item = ctx.repo.resolve(ref)
    const { id, title, status, links: _links, ...rest } = item.meta
    ctx.out(`${title}\n${label(item)}  ${id}  [${status}]`)
    for (const [k, v] of Object.entries(rest)) ctx.out(`  ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    for (const l of ctx.repo.linksOf(item)) {
      const other = ctx.repo.byId.get(l.id)
      const says = ctx.registry.relations.get(l.rel)?.says ?? l.rel
      ctx.out(`  ${says} ${other ? `${label(other)} [${other.meta.status}]` : l.id}${l.implied ? "  (inverse)" : ""}`)
    }
    const att = join(item.dir, ATTACHMENTS)
    const files = existsSync(att) ? readdirSync(att).filter((f) => !f.startsWith(".")) : []
    if (files.length) ctx.out(`  attachments: ${files.join(", ")}`)
    ctx.out("")
    ctx.out(readReadme(item).trimEnd())
    return 0
  },
}

const list: Command = {
  name: "list",
  says: "list items, most urgent first",
  usage: "list [type] [--open]",
  options: [{ name: "--open", says: "only items whose status is in the open category" }],
  examples: ["list", "list bugs --open"],
  run(args, ctx) {
    const p = parse(args, { open: { type: "boolean" } })
    const typeId = p.positionals[0]
    if (typeId) typeOrThrow(ctx, typeId)
    const items = ctx.repo.items.filter((i) => (!typeId || i.type === typeId) && (!bool(p, "open") || isOpen(ctx, i)))
    for (const item of byUrgency(ctx, items)) ctx.out(line(item))
    ctx.out(`${items.length} item${items.length === 1 ? "" : "s"}`)
    return 0
  },
}

const set: Command = {
  name: "set",
  says: "set fields on an item; an empty value removes the field",
  usage: "set <item> field=value...",
  examples: ["set export-drops status=partial area=export", "set export-drops area="],
  run(args, ctx) {
    const [ref, ...rest] = parse(args).positionals
    if (!ref?.trim() || !rest.length) throw usageError(this)
    const item = ctx.repo.resolve(ref)
    setFields(ctx, item, pairs(rest))
    ctx.out(`${label(item)}: ${rest.join(" ")}`)
    return 0
  },
}

const link: Command = {
  name: "link",
  says: "link two items; only this direction is stored, the inverse is derived",
  usage: "link <from> <relation> <to>",
  examples: ["link export-keeps verifies export-drops", "link export-drops blocked-by release-notes"],
  run(args, ctx) {
    const [from, rel, to] = parse(args).positionals
    if (!from || !rel || !to) throw usageError(this)
    const a = ctx.repo.resolve(from)
    const b = ctx.repo.resolve(to)
    ctx.out(addLink(ctx, a, rel, b) ? `${label(a)} ${rel} ${label(b)}` : "already linked")
    return 0
  },
}

const unlink: Command = {
  name: "unlink",
  says: "remove a stored link",
  usage: "unlink <from> <relation> <to>",
  examples: ["unlink export-keeps verifies export-drops"],
  run(args, ctx) {
    const [from, rel, to] = parse(args).positionals
    if (!from || !rel || !to) throw usageError(this)
    const a = ctx.repo.resolve(from)
    const b = ctx.repo.resolve(to)
    const stored = a.meta.links ?? []
    const kept = stored.filter((l) => !(l.rel === rel && l.id === b.meta.id))
    if (kept.length === stored.length) throw new Error(`${label(a)} stores no "${rel}" link to ${label(b)}`)
    const { links: _links, ...rest } = a.meta
    saveMeta(ctx, { ...a, meta: kept.length ? { ...rest, links: kept } : rest })
    ctx.out(`removed ${label(a)} ${rel} ${label(b)}`)
    return 0
  },
}

const check: Command = {
  name: "check",
  says: "run every invariant; exit 1 on any problem",
  usage: "check",
  examples: ["check"],
  async run(_args, ctx) {
    const { problems, notes } = await runChecks(ctx)
    ctx.out(`${ctx.repo.items.length} items, ${ctx.registry.checks.length} checks`)
    if (notes.length) {
      ctx.out("\nnotes (not failures):")
      for (const n of notes) ctx.out(`  · ${n.message}`)
    }
    if (problems.length) {
      ctx.out(`\nFAILED (${problems.length}):`)
      for (const p of problems) ctx.out(`  ✗ ${p.message}`)
      return 1
    }
    ctx.out("\nall invariants hold")
    return 0
  },
}

/** A board is derived on demand and never stored. */
export function renderBoard(ctx: Context, type: TypeDef, all: boolean): string[] {
  const items = ctx.repo.items.filter((i) => i.type === type.id)
  const open = byUrgency(ctx, items.filter((i) => isOpen(ctx, i)))
  const out = [`# ${type.title}`, "", `${open.length} open, ${items.length - open.length} done`]
  const sections = groupBy(open, (item) => fieldValue(item, SECTION) ?? "")
  for (const [section, group] of [...sections].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))) {
    out.push("", `## ${section || "(no section)"}`, ...group.map(line))
  }
  if (all) {
    const done = items.filter((i) => !isOpen(ctx, i))
    if (done.length) out.push("", "## done", ...done.map(line))
  }
  return out
}

const board: Command = {
  name: "board",
  says: "print a type's board, grouped by section, most urgent first",
  usage: "board <type> [--all]",
  options: [{ name: "--all", says: "also list the items whose status is done" }],
  examples: ["board bugs", "board todos --all"],
  run(args, ctx) {
    const p = parse(args, { all: { type: "boolean" } })
    for (const l of renderBoard(ctx, typeOrThrow(ctx, p.positionals[0]), bool(p, "all"))) ctx.out(l)
    return 0
  },
}

/** The format the leading --json or --markdown of `args` asks for, and the arguments after them. */
function formatOf(args: string[]): { format: Format; rest: string[] } {
  let format: Format = "text"
  let at = 0
  for (; at < args.length; at++) {
    const flag = args[at]
    if (flag === "--json") format = "json"
    else if (flag === "--markdown") format = "markdown"
    else break
  }
  return { format, rest: args.slice(at) }
}

const view: Command = {
  name: "view",
  says: "print a plugin view — as text, its data as JSON, or markdown; without a name, list them",
  usage: "view [--json | --markdown] [name] [args...]",
  options: [
    { name: "--json", says: "print the view's data as JSON, as the view derived it" },
    { name: "--markdown", says: "print the view as markdown, or as its text when it has no markdown of its own" },
  ],
  examples: ["view", "view next 10", "view --json next 10"],
  async run(args, ctx) {
    const { format, rest: [name, ...rest] } = formatOf(args)
    const views = ctx.registry.contributions("views")
    if (!name) {
      for (const c of views) ctx.out(`  ${shortOrId(ctx, "views", c).padEnd(16)} ${(c.value as View).says}`)
      return 0
    }
    const v = ctx.registry.find<View>("views", name)?.value
    if (!v) throw new Error(`no view "${name}" — views: ${views.map((c) => shortOrId(ctx, "views", c)).join(", ")}`)
    for (const l of linesAs(asRendered(await v.render(rest, ctx), `view "${name}"`), format)) ctx.out(l)
    return 0
  },
}

const summary: Command = {
  name: "summary",
  says: "where the project stands, in one screen: every plugin's section",
  usage: "summary [--json | --markdown]",
  options: [
    { name: "--json", says: "print the sections as one JSON object, section name to the data it rendered" },
    { name: "--markdown", says: "print each section under its own heading, as markdown" },
  ],
  examples: ["summary", "summary --json", "summary --markdown"],
  async run(args, ctx) {
    const p = parse(args, { json: { type: "boolean" }, markdown: { type: "boolean" } })
    if (bool(p, "json") && bool(p, "markdown")) throw usageError(this)
    const sections = await Promise.all(
      ctx.registry.contributions("summary").map(async (c) => ({
        name: shortOrId(ctx, "summary", c),
        rendering: asRendered(await (c.value as SummarySection).render(ctx), `summary section "${c.name}"`),
      })),
    )
    if (bool(p, "json")) {
      ctx.out(JSON.stringify(Object.fromEntries(sections.map((s) => [s.name, s.rendering.data])), null, 2))
      return 0
    }
    const markdown = bool(p, "markdown")
    for (const s of sections) {
      const lines = linesAs(s.rendering, markdown ? "markdown" : "text")
      if (!lines.length) continue
      ctx.out(markdown ? `## ${s.name}\n` : `── ${s.name}`)
      for (const l of lines) ctx.out(l)
      ctx.out()
    }
    return 0
  },
}

const plugins: Command = {
  name: "plugins",
  says:
    "list loaded plugins, the extension points each declares, what each uses of the others, and what each contributes to every point; a contribution's qualified id is <plugin>/<name>, shown when its short name is shared or renamed",
  usage: "plugins",
  examples: ["plugins"],
  run(_args, ctx) {
    for (const p of ctx.registry.plugins) {
      ctx.out(`${p.name} — ${p.says}`)
      if (p.points?.length) ctx.out(`  ${"points".padEnd(10)} ${p.points.map((pt) => pt.id).join(", ")}`)
      const uses = Object.entries(p.uses ?? {}).filter(([, refs]) => refs.length)
      if (uses.length) ctx.out(`  ${"uses".padEnd(10)} ${uses.map(([id, refs]) => `${id} ${refs.join(", ")}`).join("; ")}`)
      for (const kind of ctx.registry.points.keys()) {
        const mine = ctx.registry.contributions(kind).filter((c) => c.plugin === p.name)
        // The short name a person types, and the qualified id when it differs from <plugin>/<name> or the short name is shared.
        const said = mine.map((c) => (shortOrId(ctx, kind, c) === c.name && c.id === `${p.name}/${c.name}` ? c.name : `${c.name} (${c.id})`))
        if (said.length) ctx.out(`  ${kind.padEnd(10)} ${said.join(", ")}`)
      }
    }
    return 0
  },
}

/** What `c` declares it starts: its `runs`, the external programs any contribution may name. */
const runsOf = (c: Contribution): string[] => {
  const runs = (c.value as { runs?: unknown } | null)?.runs
  return Array.isArray(runs) ? runs.filter((r): r is string => typeof r === "string") : []
}

/** Every contribution, to any point, that declares programs it starts. */
const starting = (ctx: Context): { point: string; c: Contribution }[] =>
  [...ctx.registry.points.keys()].flatMap((point) => ctx.registry.contributions(point).filter((c) => runsOf(c).length).map((c) => ({ point, c })))

/** The programs the loaded contributions declare they start: what the launcher grants besides git. */
export const declaredRuns = (ctx: Context): string[] => [...new Set(starting(ctx).flatMap(({ c }) => runsOf(c)))].sort()

const runs: Command = {
  name: "runs",
  says: "list the external programs the loaded contributions declare they start (a model checker, say), which the launcher allows besides git",
  usage: "runs [--json]",
  options: [{ name: "--json", says: "print them as one JSON list: what the launcher reads" }],
  examples: ["runs", "runs --json"],
  run(args, ctx) {
    const p = parse(args, { json: { type: "boolean" } })
    const tools = declaredRuns(ctx)
    if (bool(p, "json")) ctx.out(JSON.stringify(tools))
    else if (!tools.length) ctx.out("no contribution starts a program: the launcher allows git alone")
    else for (const { point, c } of starting(ctx)) ctx.out(`  ${point.padEnd(10)} ${c.id.padEnd(24)} ${runsOf(c).join(", ")}`)
    return 0
  },
}

const types: Command = {
  name: "types",
  says: "list item types, their statuses and fields",
  usage: "types",
  examples: ["types"],
  run(_args, ctx) {
    for (const t of ctx.registry.types.values()) {
      ctx.out(`${t.id} (${ctx.trackerDir}/${t.dir}/) — ${t.says}`)
      for (const [name, s] of Object.entries(t.statuses)) {
        ctx.out(`  ${name.padEnd(10)} ${[s.category, ...flagsOf(s)].join(", ")} — ${s.says}`)
      }
      const fields = [...ctx.registry.fields.values()].filter((f) => appliesTo(f, t.id)).map((f) => f.name)
      ctx.out(`  fields: ${fields.join(", ")}`)
    }
    return 0
  },
}

const counts: SummarySection = {
  name: "items",
  render(ctx) {
    const rows = [...ctx.registry.types.values()].flatMap((t) => {
      const mine = ctx.repo.items.filter((i) => i.type === t.id)
      const open = mine.filter((i) => isOpen(ctx, i)).length
      return mine.length ? [{ type: t.id, open, done: mine.length - open }] : []
    })
    return rendered(
      rows,
      (rs) => rs.map((r) => `  ${r.type.padEnd(12)} ${String(r.open).padStart(4)} open  ${String(r.done).padStart(4)} done`),
      (rs) => (rs.length ? ["| Type | Open | Done |", "|---|---|---|", ...rs.map((r) => `| ${r.type} | ${r.open} | ${r.done} |`)] : []),
    )
  },
}

/** A type's transitions, held on every write: a status moves only to one its type allows from where it is. */
const statusMoves: WriteHook = {
  name: "status-moves",
  says:
    "a status moves only to one its type's transitions allow from the status it has; a status the transitions do not name moves to any, and --force takes the move on",
  beforeWrite(write, ctx) {
    const { item, before } = write
    if (write.kind !== "update" || !before || before.status === item.meta.status || write.force) return
    const allowed = ctx.registry.types.get(item.type)?.transitions
    const to = allowed && Object.hasOwn(allowed, before.status) ? allowed[before.status] : undefined
    if (!to || to.includes(item.meta.status)) return
    return `${label(item)}: from ${before.status} its status moves to ${to.join(", ") || "nothing"}, not ${item.meta.status}`
  },
}

export const corePlugin: Plugin = {
  name: "core",
  contract: CONTRACT,
  says: "items, fields, links and the invariants every project has",
  about: "An item is a directory under `<tracker>/<TYPE>/<slug>/`: `README.md` for the prose, `meta.json` for the fields, `attachments/` for the evidence. " +
    "`meta.json` always holds `id` (a permanent uuid), `title` and `status` (one the item's type declares), and optionally `links`, a list of `{ rel, id }`. The slug may change; the id may not, and links hold ids. " +
    "An item reference on the command line is an id, `type/slug`, a slug, or a fragment of a slug that matches one item. " +
    "Fields are typed by the plugin that declares them — `string`, `strings` (comma-separated on the command line), `date` (YYYY, YYYY-MM or YYYY-MM-DD), `enum` (values in rank order), `boolean`, `number`, `object` (a JSON object, written as JSON on the command line) — and unknown fields are kept and not checked. " +
    "Only one direction of a link is stored; the inverse is derived when read. Boards, queues, gate states and summaries are derived when asked and never stored. " +
    "An item is open or done by its status's category; urgency is the sum of every plugin's rank terms, and done items sink.",
  fields: [
    { name: "section", kind: "string", says: "the heading the item is grouped under on its board" },
    { name: "created", kind: "date", says: "when the item was opened" },
    { name: "tags", kind: "strings", says: "free labels a person puts on an item" },
  ],
  relations: [
    { name: "relates-to", inverse: "relates-to", says: "is related to" },
    { name: "duplicate-of", inverse: "duplicate-of", says: "describes the same thing as" },
    { name: "blocks", inverse: "blocked-by", says: "must be resolved before" },
    { name: "blocked-by", inverse: "blocks", says: "waits on" },
  ],
  checks: coreChecks,
  commands: [newCommand, show, list, set, link, unlink, check, board, view, summary, plugins, types, runs],
  summary: [counts],
  hooks: [statusMoves],
}
