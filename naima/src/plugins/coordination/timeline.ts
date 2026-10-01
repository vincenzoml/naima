// The timeline: when a gate opened and passed, when an epic began and
// finished, each release and each session — every event derived at read time
// from the items and git, nothing stored. A gate opened is its first item
// reported (`created`), a gate passed its last item resolved (`closedOn`, else
// `fixedOn`) once none is open; an epic the same, from the items it groups; a
// release is a version tag; a session is its note. What has no date is
// counted at the foot, never placed at a guess.
//
// Only what nothing derives — a decision taken outside the tracker, a build
// handed out, a policy, an outside fact — is a record: one file per event,
// `<data>/events/<date>-<uuid>.md`, written by `naima event`.
//
// It reads other plugins' vocabulary by name and declares none of it used:
// without gates or epics loaded there are simply no gate or epic events.

import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import {
  type BranchFile,
  type Command,
  type Context,
  currentBranch,
  fieldValue,
  fieldValues,
  gitOrNull,
  hasTrait,
  isOpen,
  type Item,
  label,
  linked,
  parse,
  readAcrossBranches,
  rendered,
  str,
  usageError,
  type View,
  writeFileAtomic,
} from "../../core/api.ts"

export const EVENTS = "events"

export type EventKind = "gate opened" | "gate passed" | "epic opened" | "epic finished" | "release" | "session" | "record"

export interface TimelineEvent {
  date: string
  kind: EventKind
  /** What it is about: a gate's name, an epic's or a release's label, a session's branch. */
  subject: string
  /** In words: what it is and where its date comes from. */
  says: string
}

export interface Timeline {
  events: TimelineEvent[]
  /** What happened but carries no date, by kind: counted, never placed. */
  undated: Partial<Record<EventKind, number>>
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !DATE.test(v)) return false
  const t = Date.parse(`${v}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v
}

const GATE = { name: "gate", kind: "enum" } as const
const CLOSED_ON = { name: "closedOn", kind: "date" } as const
const FIXED_ON = { name: "fixedOn", kind: "date" } as const
const GROUP = "group"
const HAS_PART = "has-part"
/** A tag that names a version: v1, 1.2, v0.9.0-rc.1. */
const VERSION_TAG = /^v?\d+(\.\d+)*([-+].*)?$/

const created = (i: Item): string | undefined => (isDate(i.meta["created"]) ? i.meta["created"] : undefined)
/** When an item was resolved: archived, else its code landed; undefined while open or when it says neither. */
const resolved = (ctx: Context, i: Item): string | undefined => {
  if (isOpen(ctx, i)) return undefined
  const d = fieldValue(i, CLOSED_ON) ?? fieldValue(i, FIXED_ON)
  return isDate(d) ? d : undefined
}

/** What an item stands for: itself, or — a group with members — its members, a nested group's too. */
function standsFor(ctx: Context, item: Item, seen: Set<Item> = new Set()): Item[] {
  if (seen.has(item)) return []
  seen.add(item)
  if (!hasTrait(ctx, item, GROUP)) return [item]
  const members = linked(ctx, item, HAS_PART)
  return members.length ? members.flatMap((m) => standsFor(ctx, m, seen)) : [item]
}

const min = (ds: string[]): string | undefined => ds.reduce<string | undefined>((a, d) => (a === undefined || d < a ? d : a), undefined)
const max = (ds: string[]): string | undefined => ds.reduce<string | undefined>((a, d) => (a === undefined || d > a ? d : a), undefined)
const items = (n: number): string => `${n} item${n === 1 ? "" : "s"}`

/** The opening and closing of a body of items — a gate's, an epic's — or what of them has no date. */
function span(
  ctx: Context,
  members: Item[],
  open: EventKind,
  close: EventKind,
  subject: string,
  title: string,
  out: Timeline,
): void {
  if (!members.length) return
  const count = (k: EventKind) => (out.undated[k] = (out.undated[k] ?? 0) + 1)
  const born = members.map(created)
  const first = min(born.filter((d): d is string => !!d))
  if (first && born.every(Boolean)) {
    out.events.push({ date: first, kind: open, subject, says: `${title}: the first of its ${items(members.length)} reported` })
  } else count(open)
  if (members.some((m) => isOpen(ctx, m))) return
  const ends = members.map((m) => resolved(ctx, m))
  const last = max(ends.filter((d): d is string => !!d))
  if (last && ends.every(Boolean)) {
    out.events.push({ date: last, kind: close, subject, says: `${title}: the last of its ${items(members.length)} resolved` })
  } else count(close)
}

interface RecordFile {
  date: string
  kind: string
  title: string
  file: string
}

const FRONT = /^---\n([\s\S]*?)\n---\n/

function parseRecord(f: BranchFile): RecordFile | null {
  const m = f.text.match(FRONT)
  if (!m?.[1]) return null
  const field = (k: string) => m[1]?.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? ""
  const date = field("date")
  const title = f.text.slice(m[0].length).trim().split("\n")[0]?.trim() ?? ""
  return isDate(date) && title ? { date, kind: field("kind") || "fact", title, file: f.name } : null
}

/** The records of what nothing derives, on every branch. */
export const readRecords = (ctx: Context): RecordFile[] =>
  readAcrossBranches(ctx.root, `${ctx.trackerDir}/${EVENTS}`, ".md").map(parseRecord).filter((r): r is RecordFile => r !== null)

/** The version tags, each with the day of the commit it names. */
function releases(ctx: Context): { tag: string; date: string }[] {
  const out = gitOrNull(ctx.root, "for-each-ref", "refs/tags", "--format=%(refname:short)%09%(*committerdate:short)%09%(committerdate:short)")
  return (out ?? "").split("\n").flatMap((line) => {
    const [tag = "", peeled = "", own = ""] = line.split("\t")
    const date = peeled || own
    return VERSION_TAG.test(tag) && isDate(date) ? [{ tag, date }] : []
  })
}

/** Every event, derived from the items, git and the session notes, oldest first; `passes` gives the session notes. */
export function timelineOf(ctx: Context, passes: { date: string; branch: string; body: string }[]): Timeline {
  const out: Timeline = { events: [], undated: {} }
  const titles = new Map(ctx.registry.contributions("gates").map((c) => [(c.value as { name: string }).name, (c.value as { title?: string }).title ?? ""]))
  const gated = new Map<string, Item[]>()
  for (const i of ctx.repo.items) for (const g of fieldValues(i, GATE)) gated.set(g, [...(gated.get(g) ?? []), i])
  for (const [g, on] of [...gated].sort(([a], [b]) => a.localeCompare(b))) {
    const members = [...new Set(on.flatMap((i) => standsFor(ctx, i)))]
    const t = titles.get(g)
    span(ctx, members, "gate opened", "gate passed", g, `gate ${g}${t ? ` (${t})` : ""}`, out)
  }
  for (const e of ctx.repo.items.filter((i) => hasTrait(ctx, i, GROUP))) {
    const members = linked(ctx, e, HAS_PART).filter((m) => m.meta.id !== e.meta.id)
    span(ctx, members, "epic opened", "epic finished", label(e), `${label(e)} (${e.meta.title})`, out)
  }
  for (const r of releases(ctx)) out.events.push({ date: r.date, kind: "release", subject: r.tag, says: `version tag ${r.tag}` })
  for (const p of passes) {
    const first = p.body.split("\n").find((l) => l.trim())?.trim() ?? ""
    out.events.push({ date: p.date, kind: "session", subject: p.branch, says: `session note on ${p.branch}${first ? `: ${first}` : ""}` })
  }
  for (const r of readRecords(ctx)) out.events.push({ date: r.date, kind: "record", subject: r.kind, says: `${r.kind}: ${r.title}` })
  out.events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
}

const KIND_WIDTH = 13

const undatedLine = (u: Timeline["undated"]): string[] => {
  const parts = Object.entries(u).map(([k, n]) => `${k} ${n}`)
  return parts.length ? [`undated, not placed: ${parts.join(", ")} — an item without created, or resolved without closedOn or fixedOn`] : []
}

/** `naima view timeline`. */
export function timelineView(passes: (ctx: Context) => { date: string; branch: string; body: string }[]): View {
  return {
    name: "timeline",
    says:
      "when each gate opened and passed, each epic began and finished, each release and session — derived from the items and git, nothing stored; undated ones counted at the foot",
    render(_args, ctx) {
      const t = timelineOf(ctx, passes(ctx))
      return rendered(
        t,
        (d) => [
          ...(d.events.length ? d.events.map((e) => `${e.date}  ${e.kind.padEnd(KIND_WIDTH)} ${e.says}`) : ["no events yet"]),
          ...undatedLine(d.undated),
        ],
        (d) => [
          "| Date | Event | What |",
          "| --- | --- | --- |",
          ...d.events.map((e) => `| ${e.date} | ${e.kind} | ${e.says.replace(/\|/g, "\\|")} |`),
          ...(undatedLine(d.undated).length ? ["", ...undatedLine(d.undated)] : []),
        ],
      )
    },
  }
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** The timeline as a tab of `naima ui`: the shape the `ui-views` point takes, declared here since plugins never import each other. */
export function timelineUiView(passes: (ctx: Context) => { date: string; branch: string; body: string }[]) {
  return {
    name: "timeline",
    title: "Timeline",
    // After the tabs of the work itself — the metrics first — whatever the load order.
    order: 10,
    says: "the project's events — gates, epics, releases, sessions, records — derived from the items and git, oldest first",
    render(_params: Record<string, string[]>, ctx: Context) {
      const t = timelineOf(ctx, passes(ctx))
      const rows = t.events.map((e) => `<tr><td>${e.date}</td><td>${esc(e.kind)}</td><td>${esc(e.says)}</td></tr>`)
      const foot = undatedLine(t.undated).map((l) => `<p class="foot">${esc(l)}</p>`)
      return {
        data: t,
        html: [
          "<h1>Timeline</h1>",
          t.events.length
            ? `<table><thead><tr><th>Date</th><th>Event</th><th>What</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
            : "<p>No events yet.</p>",
          ...foot,
        ].join("\n"),
        css:
          "body{font-family:system-ui,sans-serif;margin:16px}table{border-collapse:collapse}td,th{text-align:left;padding:2px 12px 2px 0;vertical-align:top}td:first-child{white-space:nowrap}.foot{color:#888}",
      }
    },
  }
}

/** `naima event`: record what nothing derives, one file per event. */
export const eventCommand: Command = {
  name: "event",
  says:
    "record an event the timeline cannot derive — a decision taken elsewhere, a build handed out, a policy, an outside fact — as one new file; everything else on `naima view timeline` is derived",
  usage: 'event <YYYY-MM-DD> "<what happened>" [--kind <kind>]',
  options: [{ name: "--kind", says: "what sort of event: decision, build, policy, fact, or any word", default: "fact" }],
  examples: ['event 2026-09-14 "Build 3 handed to the testers" --kind build', 'event 2026-09-20 "The vendor ended support for v1"'],
  run(args, ctx) {
    const p = parse(args, { kind: { type: "string" } })
    const [date, ...words] = p.positionals
    const text = words.join(" ").trim()
    if (!date || !text) throw usageError(this)
    if (!isDate(date)) throw new Error(`an event's date is YYYY-MM-DD, got ${JSON.stringify(date)}`)
    const kind = (str(p, "kind") ?? "fact").trim()
    if (!/^[a-z0-9][a-z0-9-]*$/.test(kind)) throw new Error(`an event's kind is one word of lowercase letters, digits and dashes, got ${JSON.stringify(kind)}`)
    const dir = join(ctx.trackerRoot, EVENTS)
    mkdirSync(dir, { recursive: true })
    const name = `${date}-${randomUUID()}.md`
    writeFileAtomic(join(dir, name), `---\ndate: ${date}\nkind: ${kind}\n---\n\n${text}\n`)
    ctx.out(`wrote ${ctx.trackerDir}/${EVENTS}/${name} — commit it on ${currentBranch(ctx.root)}`)
    return 0
  },
}
