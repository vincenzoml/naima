// The data format, and moving data forward from one format to the next.
//
// `naima.json` carries `format`, an integer: the core's own. Each plugin that
// carries migrations has a format of its own too, in `formats`, so a plugin
// can rename its field or move its setting without every other plugin's data
// moving in lockstep. A Naima reads exactly its own formats: older data is
// migrated by `naima update`, newer data is refused. Migrations are forward
// only and deterministic — the same input gives byte-identical output — and
// idempotent, so a branch that merges a migrated trunk runs `naima update`
// again to finish the migration of its own new items. `check` fails on items
// still in a shape a migration replaced.
//
// Format 1 is the first format of the open specification (docs/reference/format.md).
// Each migration adds one, so the format this Naima reads is 1 + the number
// of migrations it carries, and a plugin's is 1 + the number of its own.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { DATA_FILE } from "./layout.ts"
import { listDirs, META } from "./item.ts"
import { writeFileAtomic } from "./files.ts"
import { label } from "./lifecycle.ts"
import { migrationsOf } from "./manifest.ts"
import { CORE_MIGRATIONS } from "./migrations.ts"
import type { Check, Finding, Migration } from "./types.ts"

export type { Migration } from "./types.ts"

type Json = Record<string, unknown>

/** Every migration of the core's own format, in order (core/migrations.ts). */
export const MIGRATIONS: readonly Migration[] = CORE_MIGRATIONS

/** The format this Naima reads and writes. */
export const FORMAT = 1 + MIGRATIONS.length

/** Whose migrations these are: a plugin by name, or the core (`null`), whose format is `format` rather than an entry of `formats`. */
export interface Migrations {
  plugin: string | null
  migrations: readonly Migration[]
}

/** One migration run, or to be run: whose, the format it reads, what it does. */
export interface Step {
  plugin: string | null
  from: number
  says: string
}

/** The format a list of migrations reaches: 1 + their number. */
export const formatOf = (migrations: readonly Migration[] | undefined): number => 1 + (migrations?.length ?? 0)

/** Whether `v` is a format number: an integer from 1. */
export const isFormat = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1

/** "format", or "<plugin> format": how a format is named in a message. */
const formatName = (plugin: string | null): string => (plugin === null ? "format" : `${plugin} format`)

/** Why data of format `format` is not this Naima's to act on, or null when it is. Read after the file name. */
export function formatRefusal(format: unknown, reads = FORMAT, plugin: string | null = null): string | null {
  const name = formatName(plugin)
  if (!isFormat(format)) {
    return plugin === null ? "has no format: it is not Naima data (docs/reference/format.md)" : `has ${name} ${JSON.stringify(format)}, which is not an integer from 1`
  }
  const whose = plugin === null ? "this Naima reads" : `this Naima's ${plugin} reads`
  if (format > reads) {
    return `is ${name} ${format}, newer than the ${name} ${reads} ${whose} — it was written by a newer Naima: record that Naima's commit`
  }
  if (format < reads) return `is ${name} ${format}, older than the ${name} ${reads} ${whose} — naima update migrates it`
  return null
}

/** The `formats` of a naima.json: plugin name to format. Throws when it is not one. */
export function formatsOf(raw: Json): Record<string, number> {
  const formats = raw["formats"] ?? {}
  if (!formats || typeof formats !== "object" || Array.isArray(formats)) throw new Error(`${DATA_FILE}: formats must map a plugin name to its format`)
  for (const [name, f] of Object.entries(formats)) {
    if (!isFormat(f)) throw new Error(`${DATA_FILE}: formats.${name} must be a format, an integer from 1`)
  }
  return formats as Record<string, number>
}

/** Refuse a list whose migrations do not go 1, 2, 3… */
export function inOrder(m: Migrations): void {
  m.migrations.forEach((step, i) => {
    if (step.from !== i + 1) {
      const whose = m.plugin === null ? "migration" : `plugin "${m.plugin}": migration`
      throw new Error(`${whose} ${i + 1} reads format ${step.from}; migrations go 1, 2, 3… with no gap`)
    }
  })
}

/** The format `raw` records for `plugin` (the core's when null); a plugin it does not name is at format 1. */
const recorded = (raw: Json, plugin: string | null): unknown => (plugin === null ? raw["format"] : formatsOf(raw)[plugin] ?? 1)

export type Pending = Step & { migration: Migration }

/**
 * The migrations `raw` still owes: the core's first, then each plugin's in the
 * order given. Throws on data newer than a format `all` reaches: nothing may
 * act on it.
 */
export function pending(raw: Json, all: readonly Migrations[]): Pending[] {
  const out: Pending[] = []
  for (const m of all) {
    inOrder(m)
    const target = formatOf(m.migrations)
    const from = recorded(raw, m.plugin)
    if (!isFormat(from) || from > target) throw new Error(`${DATA_FILE} ${formatRefusal(from, target, m.plugin)}`)
    for (const migration of m.migrations.slice(from - 1)) out.push({ plugin: m.plugin, from: migration.from, says: migration.says, migration })
  }
  return out
}

const byName = ([a]: [string, unknown], [b]: [string, unknown]): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * The naima.json `raw` becomes once every config step of `steps` has run:
 * `format` first, then `formats` — sorted, only the plugins past format 1 —
 * then the keys as the steps left them. Pure.
 */
export function migrateConfig(raw: Json, steps: readonly Pending[], all: readonly Migrations[]): Json {
  if (!steps.length) return raw
  let config = raw
  for (const s of steps) if (s.migration.config) config = s.migration.config(config)
  const formats: Record<string, number> = { ...formatsOf(raw) }
  let format = raw["format"]
  for (const m of all) {
    if (m.plugin === null) format = formatOf(m.migrations)
    else if (formatOf(m.migrations) > 1) formats[m.plugin] = formatOf(m.migrations)
  }
  const { format: _format, formats: _formats, ...rest } = config
  const sorted = Object.fromEntries(Object.entries(formats).sort(byName))
  return { format, ...(Object.keys(sorted).length ? { formats: sorted } : {}), ...rest }
}

const stringify = (value: unknown): string => JSON.stringify(value, null, 2) + "\n"

/** Every item's meta.json under `data`, in a fixed order. */
function metaFiles(data: string): string[] {
  return listDirs(data).flatMap((dir) => listDirs(join(data, dir)).map((slug) => join(data, dir, slug, META))).filter((p) => existsSync(p))
}

/**
 * Migrate the data under `data` forward to the newest formats: the core's
 * `migrations`, then each plugin's own in `plugins`. Returns the steps run, in
 * order; empty when the data is already current. Throws, writing nothing, on
 * data newer than that, and when any step throws.
 */
export function migrate(data: string, migrations: readonly Migration[] = MIGRATIONS, plugins: readonly Migrations[] = []): Step[] {
  const all: Migrations[] = [{ plugin: null, migrations }, ...plugins]
  const configPath = join(data, DATA_FILE)
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as Json
  const steps = pending(raw, all)
  if (!steps.length) return []

  const items = metaFiles(data).map((path) => {
    const text = readFileSync(path, "utf8")
    return { path, text, meta: JSON.parse(text) as Json }
  })
  const config = migrateConfig(raw, steps, all)
  for (const s of steps) {
    const item = s.migration.item
    if (item) { for (const i of items) i.meta = item(i.meta) }
  }
  // Read everything before writing anything: a migration that throws leaves the data as it was.
  for (const i of items) {
    const text = stringify(i.meta)
    if (text !== i.text) writeFileAtomic(i.path, text)
  }
  writeFileAtomic(configPath, stringify(config))
  return steps.map(({ plugin, from, says }) => ({ plugin, from, says }))
}

/** How a list of steps is said: "format 1, gates format 1". */
export const stepsSaid = (steps: readonly Step[]): string => steps.map((s) => `${formatName(s.plugin)} ${s.from} (${s.says})`).join(", ")

/**
 * The check that fails on items still in a shape a migration replaced — the
 * core's `migrations`, and every loaded plugin's own: a tracker that mixes
 * formats.
 */
export function formatCheck(migrations: readonly Migration[] = MIGRATIONS): Check {
  return {
    name: "one-format",
    says: "no item is still in a shape a format migration, the core's or a plugin's own, replaced: a tracker never mixes formats",
    run(ctx) {
      const all: Migrations[] = [{ plugin: null, migrations }, ...ctx.registry.plugins.map((p) => ({ plugin: p.name, migrations: migrationsOf(p) }))]
      const out: Finding[] = []
      for (const { plugin, migrations: list } of all) {
        for (const m of list) {
          if (!m.stale) continue
          for (const item of ctx.repo.items) {
            if (!m.stale(item.meta)) continue
            out.push({ level: "problem", message: `${label(item)} is still in ${formatName(plugin)} ${m.from} (${m.says}) — naima update migrates it`, item })
          }
        }
      }
      return out
    },
  }
}
