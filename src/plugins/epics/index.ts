// Epics: an item type that groups items. An item is `part-of` an epic (the
// inverse, `has-part`, is derived, and either side may be stored). An epic's
// status is derived from its items — open while any is open, done when every
// one is closed — and a write hook keeps it so on every write. The type
// carries the `group` trait, so a gate on an epic stands for its items.
// Data only: no type derives from another.

import {
  addLink,
  bool,
  type Check,
  type Command,
  type Context,
  CONTRACT,
  fieldValue,
  fieldValues,
  type Finding,
  groupBy,
  hasTrait,
  isOpen,
  type Item,
  label,
  linked,
  parse,
  type Plugin,
  rendered,
  saveMeta,
  storedLinks,
  type SummarySection,
  type TypeDef,
  usageError,
  type WriteHook,
} from "../../core/api.ts"

const PART_OF = "part-of"
const HAS_PART = "has-part"
const GROUP = "group"

const epicsType: TypeDef = {
  id: "epics",
  dir: "epics",
  title: "Epics",
  says: "a body of work that groups items: its status follows them, and a gate on it stands for them",
  statuses: {
    open: { category: "open", says: "some item it groups is still open, or it groups none yet" },
    done: { category: "done", says: "every item it groups is closed" },
  },
  initialStatus: "open",
  traits: [GROUP],
  template: (title) => `# ${title}\n\nWhat this body of work delivers, and how to tell it is done.\n`,
}

const RUN_BY = { name: "runBy", kind: "enum" } as const
const GATE = { name: "gate", kind: "enum" } as const

const isEpic = (_ctx: Context, item: Item): boolean => item.type === epicsType.id

/** The items an epic groups, by a link stored on either side. */
const membersOf = (ctx: Context, epic: Item): Item[] => linked(ctx, epic, HAS_PART).filter((m) => m.meta.id !== epic.meta.id)

/** An epic's status, from its items: done when it groups some and every one is closed. */
export function derivedStatus(ctx: Context, epic: Item): "open" | "done" {
  const members = membersOf(ctx, epic)
  return members.length && members.every((m) => !isOpen(ctx, m)) ? "done" : "open"
}

/** Whose hands an item's proof needs: its own `runBy`, else that of an item verifying it. */
function handsOf(ctx: Context, item: Item): string {
  const own = fieldValue(item, RUN_BY)
  if (own !== undefined) return own
  for (const v of linked(ctx, item, "verified-by")) {
    const theirs = fieldValue(v, RUN_BY)
    if (theirs !== undefined) return theirs
  }
  return "unclassified"
}

/** One epic's progress, as `naima epic --json` prints it. */
export interface Progress {
  epic: string
  title: string
  status: string
  closed: number
  total: number
  /** Its open items: what it waits for. */
  open: string[]
  gates: string[]
  /** Its open items by whose hands they need. */
  hands: Record<string, number>
}

function progressOf(ctx: Context, epic: Item): Progress & { openItems: Item[] } {
  const members = membersOf(ctx, epic)
  const openItems = members.filter((m) => isOpen(ctx, m))
  const hands = Object.fromEntries([...groupBy(openItems, (i) => handsOf(ctx, i))].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.length]))
  return {
    epic: label(epic),
    title: String(epic.meta.title ?? ""),
    status: epic.meta.status,
    closed: members.length - openItems.length,
    total: members.length,
    open: openItems.map(label),
    gates: fieldValues(epic, GATE),
    hands,
    openItems,
  }
}

function progressLines(ctx: Context, p: Progress & { openItems: Item[] }): string[] {
  const head = `${p.epic}  ${p.title}  [${p.status}]  ${p.total ? `${p.closed} of ${p.total} closed` : "no items yet"}${
    p.gates.length ? ` · gate ${p.gates.join(", ")}` : ""
  }`
  const waiting = Object.entries(p.hands).map(([k, n]) => `${k} ${n}`).join(", ")
  return [head, ...(waiting ? [`  waiting on: ${waiting}`] : []), ...p.openItems.map((i) => `  ✗ ${label(i)}  ${i.meta.title}  (${handsOf(ctx, i)})`)]
}

const epicsOf = (ctx: Context): Item[] => ctx.repo.items.filter((i) => isEpic(ctx, i))

const epicOrThrow = (ctx: Context, ref: string | undefined): Item => {
  if (!ref) throw new Error("name the epic: naima epic add <epic> <item>...")
  const item = ctx.repo.resolve(ref)
  if (!isEpic(ctx, item)) throw new Error(`${label(item)} is not an epic — open one: naima new epics "<title>"`)
  return item
}

const command: Command = {
  name: "epic",
  says: "each epic with its progress — n of m closed, what it waits for and whose hands — or put items in an epic and take them out",
  enforces: "only an epic groups items and never itself, and its status follows its items: setting it against them is refused",
  usage: "epic [<epic>...] [--all] [--json] | epic add <epic> <item>... | epic remove <epic> <item>...",
  options: [
    { name: "--all", says: "list the done epics too" },
    { name: "--json", says: "print each epic's progress as JSON: epic, title, status, closed, total, open, gates, hands" },
  ],
  examples: [
    "epic",
    "epic onboarding --json",
    "epic add onboarding bugs/export-drops-alpha todos/first-run-copy",
    "epic remove onboarding todos/first-run-copy",
  ],
  run(args, ctx) {
    const p = parse(args, { all: { type: "boolean" }, json: { type: "boolean" } })
    const [sub, ...rest] = p.positionals
    if (sub === "add" || sub === "remove") {
      const [ref, ...items] = rest
      if (!items.length) throw usageError(this)
      const epic = epicOrThrow(ctx, ref)
      for (const item of items.map((r) => ctx.repo.resolve(r))) {
        if (item.meta.id === epic.meta.id) throw new Error(`${label(epic)} cannot be part of itself`)
        if (sub === "add") {
          addLink(ctx, item, PART_OF, ctx.repo.resolve(label(epic)))
        } else {
          const fresh = (i: Item) => ctx.repo.resolve(label(i))
          const drop = (from: Item, rel: string, to: Item): void => {
            const links = storedLinks(from.meta)
            const kept = links.filter((l) => !(l.rel === rel && l.id === to.meta.id))
            if (kept.length !== links.length) saveMeta(ctx, { ...from, meta: { ...from.meta, links: kept } })
          }
          if (!membersOf(ctx, fresh(epic)).some((m) => m.meta.id === item.meta.id)) throw new Error(`${label(item)} is not part of ${label(epic)}`)
          drop(fresh(item), PART_OF, epic)
          drop(fresh(epic), HAS_PART, item)
        }
        ctx.out(`${label(item)}: ${sub === "add" ? "part of" : "no longer part of"} ${label(epic)}`)
      }
      return 0
    }
    const chosen = p.positionals.length ? p.positionals.map((r) => epicOrThrow(ctx, r)) : epicsOf(ctx).filter((e) => bool(p, "all") || isOpen(ctx, e))
    const rows = chosen.map((e) => progressOf(ctx, e))
    if (bool(p, "json")) {
      ctx.out(JSON.stringify(rows.map(({ openItems: _, ...r }) => r), null, 2))
      return 0
    }
    if (!rows.length) ctx.out(`no ${bool(p, "all") ? "" : "open "}epics — open one: naima new epics "<title>", then naima epic add <epic> <item>...`)
    for (const r of rows) for (const l of progressLines(ctx, r)) ctx.out(l)
    return 0
  },
}

/** The epics an item is part of, by a link on either side; `links` adds those it held before the write. */
function epicsAround(ctx: Context, item: Item, before: Item["meta"] | null): Item[] {
  const ids = new Set([
    ...linked(ctx, item, PART_OF).map((e) => e.meta.id),
    ...(before ? storedLinks(before).filter((l) => l.rel === PART_OF).map((l) => l.id) : []),
  ])
  return [...ids].map((id) => ctx.repo.byId.get(id)).filter((e): e is Item => !!e && isEpic(ctx, e))
}

const hook: WriteHook = {
  name: "epic-status",
  says: "an epic's status follows its items: set on every write of the epic, and of an item it groups; setting it against them is refused",
  beforeWrite(write, ctx) {
    if (write.kind === "move" || !isEpic(ctx, write.item)) return
    const derived = derivedStatus(ctx, write.item)
    const asked = write.item.meta.status
    if (write.before && asked !== write.before.status && asked !== derived) {
      return `an epic's status follows its items: it is ${derived} — close its open items, or take them out with naima epic remove`
    }
    write.item.meta.status = derived
  },
  afterWrite(write, ctx) {
    for (const epic of epicsAround(ctx, write.item, write.before)) {
      if (epic.meta.id === write.item.meta.id) continue
      if (derivedStatus(ctx, epic) !== epic.meta.status) saveMeta(ctx, { ...epic, meta: { ...epic.meta } })
    }
  },
}

const check: Check = {
  name: "epics",
  says:
    "an item is part of an epic, never of an item of another type; an open epic groups at least one item; an epic's status is the one its items give it, as the epic-status hook writes it, hand edits included",
  run(ctx) {
    const out: Finding[] = []
    for (const item of ctx.repo.items) {
      for (const l of storedLinks(item.meta)) {
        const [member, group] = l.rel === PART_OF ? [item, ctx.repo.byId.get(l.id)] : l.rel === HAS_PART ? [ctx.repo.byId.get(l.id), item] : []
        if (!member || !group || hasTrait(ctx, group, GROUP)) continue
        out.push({
          level: "problem",
          item,
          message: `${label(member)} is part of ${label(group)}, which is not an epic — naima unlink ${label(item)} ${l.rel} ${l.id}`,
        })
      }
      // The check counterpart of the epic-status hook: a hand edit of an epic's meta.json never meets it.
      if (isEpic(ctx, item) && item.meta.status !== derivedStatus(ctx, item)) {
        const derived = derivedStatus(ctx, item)
        out.push({
          level: "problem",
          item,
          message: `${
            label(item)
          } is ${item.meta.status}, but its items make it ${derived}: an epic's status follows its items — naima set ${item.slug} status=${derived}`,
        })
      }
      if (isEpic(ctx, item) && isOpen(ctx, item) && !membersOf(ctx, item).length) {
        out.push({ level: "note", item, message: `${label(item)} groups no items yet — naima epic add ${item.slug} <item>...` })
      }
    }
    return out
  },
}

const summary: SummarySection = {
  name: "epics",
  render(ctx) {
    const rows = epicsOf(ctx).filter((e) => isOpen(ctx, e)).map((e) => progressOf(ctx, e))
    return rendered(
      rows.map(({ openItems: _, ...r }) => r),
      (rs) =>
        rs.map((r) =>
          `  ${r.epic.padEnd(32)} ${r.total ? `${r.closed} of ${r.total} closed` : "no items yet"}${r.gates.length ? ` · gate ${r.gates.join(", ")}` : ""}`
        ),
    )
  },
}

export default function epics(): Plugin {
  return {
    name: "epics",
    contract: CONTRACT,
    says: "epics: bodies of work that group items, their status and progress derived from them",
    about: "An epic groups items: `naima epic add <epic> <item>...` links each item `part-of` the epic (the inverse, `has-part`, is derived). " +
      "Its status is derived, never set: open while any item it groups is open, done when every one is closed. " +
      "`naima epic` shows each open epic with its progress — n of m closed — what it waits for, and whose hands. " +
      "An epic can carry a gate (`naima gate add <gate> <epic>`): its type carries the `group` trait, so the gate stands for the items it groups.",
    types: [epicsType],
    relations: [
      { name: PART_OF, inverse: HAS_PART, says: "is part of" },
      { name: HAS_PART, inverse: PART_OF, says: "groups" },
    ],
    // What it reads of others: who performs a proof, and the gates an epic carries.
    uses: { fields: [RUN_BY.name, GATE.name], relations: ["verified-by"] },
    commands: [command],
    hooks: [hook],
    checks: [check],
    summary: [summary],
  }
}
