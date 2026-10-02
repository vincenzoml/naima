// Coverage of a normative list: a list the project declares elsewhere — paid
// features, limits, API endpoints — read from its source on every run, never
// copied, each entry with the proving item that names it, or NO TEST.
//
//   "plugins": { "gates": { "options": { "coverage": {
//     "paid": { "says": "…", "json": "plans.json", "path": "plans.*.features", "key": "id" },
//     "api":  { "files": ["src/**/*.ts"], "pattern": "route\\(\"([^\"]+)\"" } } } } }
//
// A proving item (a test) names what it proves in `covers`: `<entry>`, or
// `<list>:<entry>` when the entry's list must be said. A gate may require a
// list (`coverage: ["paid"]`): each entry with NO TEST blocks it.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { type Context, fieldValue, isEvidenceType, type Item, label, pathMatches, projectFiles } from "../../core/api.ts"

export interface CoverageConfig {
  says?: string
  /** A JSON file, from the project root. */
  json?: string
  /** Where in it the list is: keys joined by dots, `*` for every element or value. */
  path?: string
  /** The field naming an entry, when the list's elements are objects. */
  key?: string
  /** Files to search, from the project root: paths or patterns with * and **. */
  files?: string[]
  /** A regular expression over those files: each match is an entry, its first group when it has one. */
  pattern?: string
}

export const COVERS = { name: "covers", kind: "strings" } as const

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** The project's lists, validated: one source each, a JSON file or files with a pattern. */
export function readCoverage(options: Record<string, unknown>): Record<string, CoverageConfig> {
  const lists = options["coverage"] ?? {}
  if (!isObject(lists)) throw new Error("gates: options.coverage must be an object")
  for (const [name, raw] of Object.entries(lists)) {
    const at = `gates: coverage "${name}"`
    if (!isObject(raw)) throw new Error(`${at} is not an object`)
    const c = raw as CoverageConfig
    if (c.says !== undefined && typeof c.says !== "string") throw new Error(`${at}: says is a sentence`)
    if ((c.json === undefined) === (c.files === undefined)) throw new Error(`${at}: one source, json or files with pattern`)
    if (c.json !== undefined) {
      if (typeof c.json !== "string" || !c.json.trim()) throw new Error(`${at}: json is a file, from the project root`)
      if (c.path !== undefined && typeof c.path !== "string") throw new Error(`${at}: path is keys joined by dots`)
      if (c.key !== undefined && typeof c.key !== "string") throw new Error(`${at}: key is a field name`)
    } else {
      if (!Array.isArray(c.files) || !c.files.length || !c.files.every((f) => typeof f === "string")) {
        throw new Error(`${at}: files is a list of paths or patterns`)
      }
      if (typeof c.pattern !== "string") throw new Error(`${at}: files needs a pattern`)
      try {
        new RegExp(c.pattern)
      } catch {
        throw new Error(`${at}: pattern is not a regular expression: ${JSON.stringify(c.pattern)}`)
      }
    }
  }
  return lists as Record<string, CoverageConfig>
}

/** The values at `path` in `doc`: keys joined by dots, `*` for every element or value. */
function at(doc: unknown, path: string): unknown[] {
  let here: unknown[] = [doc]
  for (const seg of path.split(".").filter(Boolean)) {
    here = here.flatMap((v) => {
      if (seg === "*") return Array.isArray(v) ? v : isObject(v) ? Object.values(v) : []
      if (Array.isArray(v)) return /^\d+$/.test(seg) && Number(seg) < v.length ? [v[Number(seg)]] : []
      return isObject(v) && Object.hasOwn(v, seg) ? [v[seg]] : []
    })
  }
  return here
}

const scalar = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined)

/** A list's entries, in the order its source gives them, read now; an error saying why when the source cannot be read. */
export function entriesOf(ctx: Context, c: CoverageConfig): string[] {
  const out: string[] = []
  if (c.json !== undefined) {
    let text: string
    try {
      text = readFileSync(join(ctx.root, c.json), "utf8")
    } catch {
      throw new Error(`${c.json} cannot be read`)
    }
    let doc: unknown
    try {
      doc = JSON.parse(text)
    } catch (e) {
      throw new Error(`${c.json} is not JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
    for (const v of at(doc, c.path ?? "")) {
      const elements = Array.isArray(v) ? v : isObject(v) ? Object.keys(v) : [v]
      for (const e of elements) {
        const id = isObject(e) ? scalar(e[c.key ?? "id"]) : scalar(e)
        if (id !== undefined) out.push(id)
      }
    }
  } else {
    const re = new RegExp(c.pattern ?? "", "gm")
    for (const f of projectFiles(ctx.root, ctx.program).filter((f) => (c.files ?? []).some((p) => pathMatches(f, p)))) {
      let text: string
      try {
        text = readFileSync(join(ctx.root, f), "utf8")
      } catch {
        continue
      }
      for (const m of text.matchAll(re)) if (m[0]) out.push(m[1] ?? m[0])
    }
  }
  return [...new Set(out)]
}

/** One list's coverage, as `naima coverage --json` prints it. */
export interface CoverageRow {
  list: string
  says: string
  entries: { entry: string; tests: { item: string; status: string }[] }[]
  /** Why the source could not be read: then there are no entries. */
  error?: string
}

/** What a proving item covers: `[list, entry]`, the list undefined when the value names none. */
const coveredBy = (lists: Record<string, CoverageConfig>, value: string): [string | undefined, string] => {
  const i = value.indexOf(":")
  const list = i > 0 ? value.slice(0, i) : ""
  return Object.hasOwn(lists, list) ? [list, value.slice(i + 1)] : [undefined, value]
}

const coversOf = (i: Item): string[] => fieldValue(i, COVERS) ?? []
const provers = (ctx: Context): Item[] => ctx.repo.items.filter((i) => isEvidenceType(ctx, i.type) && coversOf(i).length)

/** The coverage of the lists named — all, when none is — each read from its source now. */
export function coverageOf(ctx: Context, lists: Record<string, CoverageConfig>, names: string[] = Object.keys(lists)): CoverageRow[] {
  const tests = provers(ctx)
  return names.map((list) => {
    const c = lists[list]
    if (!c) throw new Error(`no coverage list "${list}" — lists: ${Object.keys(lists).join(", ") || "none configured"}`)
    const row: CoverageRow = { list, says: c.says ?? "", entries: [] }
    let entries: string[]
    try {
      entries = entriesOf(ctx, c)
    } catch (e) {
      return { ...row, error: e instanceof Error ? e.message : String(e) }
    }
    row.entries = entries.map((entry) => ({
      entry,
      tests: tests
        .filter((t) =>
          coversOf(t).some((v) => {
            const [l, e] = coveredBy(lists, v)
            return e === entry && (l === undefined || l === list)
          })
        )
        .map((t) => ({ item: label(t), status: t.meta.status })),
    }))
    return row
  })
}

/** Why a list stops a gate: each entry with NO TEST, or its unreadable source. */
export function coverageReasons(ctx: Context, lists: Record<string, CoverageConfig>, names: string[]): string[] {
  return coverageOf(ctx, lists, names).flatMap((r) =>
    r.error ? [`coverage ${r.list}: ${r.error}`] : r.entries.filter((e) => !e.tests.length).map((e) => `coverage ${r.list}: ${e.entry} has NO TEST`)
  )
}

/** A `covers` value naming no entry of its list, or of any list. */
export function staleCovers(ctx: Context, lists: Record<string, CoverageConfig>, rows: CoverageRow[]): { item: Item; message: string }[] {
  if (!Object.keys(lists).length) return []
  const held = new Map(rows.filter((r) => !r.error).map((r) => [r.list, new Set(r.entries.map((e) => e.entry))]))
  const out: { item: Item; message: string }[] = []
  for (const t of provers(ctx)) {
    for (const v of coversOf(t)) {
      const [l, e] = coveredBy(lists, v)
      if (l !== undefined) {
        if (held.get(l) && !held.get(l)?.has(e)) out.push({ item: t, message: `${label(t)} covers ${v}, which list ${l} does not hold` })
      } else if (held.size === rows.length && ![...held.values()].some((s) => s.has(e))) {
        out.push({ item: t, message: `${label(t)} covers ${v}, which no coverage list holds` })
      }
    }
  }
  return out
}

/** The text `naima coverage` prints for one list. */
export function coverageLines(r: CoverageRow): string[] {
  const head = `${r.list}${r.says ? ` — ${r.says}` : ""}`
  if (r.error) return [`${head}: cannot be read — ${r.error}`]
  const covered = r.entries.filter((e) => e.tests.length).length
  const width = Math.max(0, ...r.entries.map((e) => e.entry.length))
  return [
    `${head}: ${covered} of ${r.entries.length} covered`,
    ...r.entries.map((e) => `  ${e.entry.padEnd(width)}  ${e.tests.length ? e.tests.map((t) => `${t.item} [${t.status}]`).join(", ") : "NO TEST"}`),
  ]
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Coverage as a tab of `naima ui`: the shape the `ui-views` point takes, declared here since plugins never import each other. */
export function coverageUiView(lists: Record<string, CoverageConfig>) {
  return {
    name: "coverage",
    title: "Coverage",
    order: 10,
    says: "each normative list the project declares, read from its source now, every entry with the test that proves it or NO TEST",
    render(_params: Record<string, string[]>, ctx: Context) {
      const rows = coverageOf(ctx, lists)
      const body = rows.map((r) => {
        const head = `<h2>${esc(r.list)}${r.says ? ` — ${esc(r.says)}` : ""}</h2>`
        if (r.error) return `${head}<p class="no">Cannot be read: ${esc(r.error)}</p>`
        const tr = r.entries.map((e) =>
          `<tr><td>${esc(e.entry)}</td>${
            e.tests.length ? `<td>${e.tests.map((t) => `${esc(t.item)} [${esc(t.status)}]`).join(", ")}</td>` : '<td class="no">NO TEST</td>'
          }</tr>`
        )
        return `${head}<p>${r.entries.filter((e) => e.tests.length).length} of ${r.entries.length} covered</p><table><tbody>${tr.join("")}</tbody></table>`
      })
      return {
        data: rows,
        html: ["<h1>Coverage</h1>", ...(rows.length ? body : ["<p>No list is declared: <code>plugins.gates.options.coverage</code> in naima.json.</p>"])].join(
          "\n",
        ),
        css: "body{font-family:system-ui,sans-serif;margin:16px}table{border-collapse:collapse}td{padding:2px 12px 2px 0}.no{color:#cf222e;font-weight:600}",
      }
    },
  }
}
