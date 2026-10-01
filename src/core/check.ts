// The invariants the core owns, and running every plugin's alongside them.
// A problem fails `naima check`; a note is for a human and never fails it.

import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { groupBy } from "./collections.ts"
import { message } from "./errors.ts"
import { formatCheck } from "./format.ts"
import { fieldError, fieldsOf } from "./fields.ts"
import { isUuid, README, titleWords } from "./item.ts"
import { label } from "./lifecycle.ts"
import { storedLinks } from "./repo.ts"
import type { Check, Context, Finding, Item } from "./types.ts"

const problem = (message: string, item?: Finding["item"]): Finding => (item ? { level: "problem", message, item } : { level: "problem", message })
const note = (message: string): Finding => ({ level: "note", message })

const readable: Check = {
  name: "readable",
  says:
    "every item directory has a README.md and a meta.json that parses to an object whose id, title and status are strings; no symbolic link or _-prefixed directory sits unread among the items",
  run: (ctx) => [
    ...ctx.repo.unreadable,
    ...ctx.repo.items.filter((i) => !existsSync(join(i.dir, README))).map((i) => problem(`${label(i)}: no ${README}`, i)),
  ],
}

const identity: Check = {
  name: "identity",
  says: "every item has a permanent uuid, a title and a status its type declares; ids are unique",
  run(ctx) {
    const out: Finding[] = []
    const seen = new Map<string, string>()
    for (const item of ctx.repo.items) {
      const where = label(item)
      const { id, title, status } = item.meta
      if (!isUuid(id)) out.push(problem(`${where}: id ${JSON.stringify(id)} is not a uuid`, item))
      else if (seen.has(id)) out.push(problem(`${where}: shares its id with ${seen.get(id)} — an id names one item`, item))
      else seen.set(id, where)
      if (typeof title !== "string" || !title.trim()) out.push(problem(`${where}: no title`, item))
      const statuses = ctx.registry.types.get(item.type)?.statuses ?? {}
      if (typeof status !== "string" || !Object.hasOwn(statuses, status)) {
        out.push(problem(`${where}: status ${JSON.stringify(status)} is not one of: ${Object.keys(statuses).join(", ")}`, item))
      }
    }
    return out
  },
}

const fields: Check = {
  name: "fields",
  says: "every declared field holds a value of its declared kind",
  run(ctx) {
    const out: Finding[] = []
    for (const item of ctx.repo.items) {
      for (const def of fieldsOf(ctx.registry, item)) {
        const error = fieldError(def, item.meta[def.name])
        if (error) out.push(problem(`${label(item)}: ${def.name} ${JSON.stringify(item.meta[def.name])} ${error}`, item))
      }
    }
    return out
  },
}

const links: Check = {
  name: "links",
  says: "every link uses a declared relation and names an existing item other than its own",
  run(ctx) {
    const out: Finding[] = []
    const relations = [...ctx.registry.relations.keys()]
    for (const item of ctx.repo.items) {
      const where = label(item)
      const raw = item.meta.links
      if (raw === undefined) continue
      if (!Array.isArray(raw)) {
        out.push(problem(`${where}: links is not a list`, item))
        continue
      }
      for (const l of raw as unknown[]) {
        const link = l as { rel?: unknown; id?: unknown }
        if (typeof link?.rel !== "string" || typeof link.id !== "string") {
          out.push(problem(`${where}: malformed link ${JSON.stringify(l)}`, item))
          continue
        }
        if (!ctx.registry.relations.has(link.rel)) out.push(problem(`${where}: relation "${link.rel}" is not one of: ${relations.join(", ")}`, item))
        if (link.id === item.meta.id) out.push(problem(`${where}: links to itself`, item))
        else if (!ctx.repo.byId.has(link.id)) out.push(problem(`${where}: ${link.rel} names ${link.id}, which is no item`, item))
        else {
          // The other item also stores the inverse: one link, written twice. Reported once, from the lower id.
          const other = ctx.repo.byId.get(link.id) as Item
          const inverse = ctx.registry.relations.get(link.rel)?.inverse
          const twice = inverse !== undefined && storedLinks(other.meta).some((l) => l.rel === inverse && l.id === item.meta.id)
          if (twice && item.meta.id < other.meta.id) {
            out.push(
              problem(`${where}: both directions of one link are stored — ${link.rel} ${label(other)}, and its inverse on ${label(other)}; unlink one`, item),
            )
          }
        }
      }
    }
    return out
  },
}

const layout: Check = {
  name: "layout",
  says: "every directory under the tracker root belongs to an item type or a plugin",
  run(ctx) {
    if (!existsSync(ctx.trackerRoot)) return [note(`${ctx.trackerDir}/ does not exist yet`)]
    return readdirSync(ctx.trackerRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !ctx.registry.dirs.has(e.name))
      .map((e) => problem(`${ctx.trackerDir}/${e.name}/ belongs to no loaded type or plugin — a misspelled type, or a plugin that is not loaded`))
  },
}

const duplicates: Check = {
  name: "duplicates",
  says: "items of one type with the same title are linked as duplicates, or reported",
  run(ctx) {
    const groups = groupBy(ctx.repo.items, (item) => `${item.type}:${titleWords(item.meta.title).join(" ")}`)
    const out: Finding[] = []
    for (const items of groups.values()) {
      if (items.length < 2) continue
      const ids = items.map((i) => i.meta.id)
      const linked = items.every((i) => ctx.repo.linksOf(i).some((l) => l.rel === "duplicate-of" && ids.includes(l.id)))
      if (!linked) out.push(note(`possible duplicates, not linked: ${items.map(label).join(", ")}`))
    }
    return out
  },
}

export const coreChecks: Check[] = [readable, identity, fields, links, layout, duplicates, formatCheck()]

export interface CheckReport {
  problems: Finding[]
  notes: Finding[]
}

/** Run every check, in load order, awaiting the ones that are async. A check that throws or rejects is itself a problem, never a crash. */
export async function runChecks(ctx: Context): Promise<CheckReport> {
  const findings: Finding[] = []
  for (const check of ctx.registry.checks) {
    try {
      findings.push(...await check.run(ctx))
    } catch (e) {
      findings.push(problem(`check "${check.name}" failed to run: ${message(e)}`))
    }
  }
  return { problems: findings.filter((f) => f.level === "problem"), notes: findings.filter((f) => f.level === "note") }
}
