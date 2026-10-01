// The core's own data migrations, in order: each reads the format before it
// and writes the next. Pure: naima.json and meta.json in, the same out.

import type { Migration } from "./types.ts"

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v)

/** The name a format-1 plugin path is given in the table: its file's name, or its directory's for an index. */
function nameOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  const file = (parts.pop() ?? "").replace(/\.[^.]*$/, "")
  const base = file === "index" ? parts.pop() ?? file : file
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^[^a-z]+|-+$/g, "") || "plugin"
}

/**
 * Format 1 → 2: `plugins`, a list of third-party paths, becomes a table keyed
 * by plugin name — first-party ones included — each entry holding its own
 * `source`, `options`, `enabled`, `replacedBy` and check severities.
 */
export const pluginsTable: Migration = {
  from: 1,
  says: "plugins becomes a table keyed by plugin name: a third-party path becomes the source of an entry named after its file",
  config(raw) {
    const list = raw["plugins"]
    if (!Array.isArray(list)) return raw
    const table: Json = {}
    for (const entry of list) {
      const source = typeof entry === "string" ? entry : isObject(entry) && typeof entry["name"] === "string" ? entry["name"] : null
      if (source === null) continue // not a plugin entry in format 1 either: nothing to carry
      const options = isObject(entry) && isObject(entry["options"]) ? entry["options"] : undefined
      let name = nameOf(source)
      for (let n = 2; Object.hasOwn(table, name); n++) name = `${nameOf(source)}-${n}`
      table[name] = { source, ...(options && Object.keys(options).length ? { options } : {}) }
    }
    const { plugins: _plugins, ...rest } = raw
    return Object.keys(table).length ? { ...rest, plugins: table } : rest
  },
}

/** Every migration of the core's own format, in order. */
export const CORE_MIGRATIONS: readonly Migration[] = [pluginsTable]
