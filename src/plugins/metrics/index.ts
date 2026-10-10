// Metrics: named measurements, each the command that measures it, recorded per
// commit as evidence and held to the project's expectations.
//
// A metric is data, declared in the project's naima.json — this plugin has
// none of its own:
//
//   "plugins": { "metrics": { "options": { "metrics": {
//     "tests": { "says": "tests that pass", "run": ["deno", "task", "test"], "kind": "number",
//                "pattern": "(\\d+) passed", "atLeast": 197, "ratchet": true } } } } }
//
// run        the command, as a program and its arguments: no shell. The launcher
//            grants the program exactly the programs metrics name (`naima runs`).
// measure    instead of run: a code-quality number taken in process from the
//            files (code.ts) — loc, files, functions, function-size, complexity,
//            duplication, todos, dependencies — reading `language`, `include`,
//            `exclude`, `statistic`, `window`.
// preset     a ready declaration (presets.ts) the metric starts from: code.complexity,
//            deno.coverage, … — any key beside it overrides the preset's.
// better     higher, lower or neither: how a change reads, in summary and the plot.
// kind       how a number is read from the run: a contribution to the
//            `metric-kinds` point. First-party: exit, number, count, duration.
// atMost     a budget; atLeast a floor; equals a baseline. At most one; none
//            records the number and holds nothing (kind exit: equals 0).
// ratchet    a gain beyond the bound fails until the bound is moved to it:
//            a budget may only go down, a floor only up.
// tolerance  the slack around the bound, for a noisy number (a duration).
// because    the item that says why the bound was last loosened.
//
// `naima metrics run --record` writes one file per run, metrics/<commit>-<id>.json,
// so two branches never write the same file. Every number is printed with the
// number it is compared to: the last one recorded on an earlier commit of this
// line of history, and the bound. `naima metrics backfill` measures past
// commits the same way — code measures from git's objects, commands in a
// temporary worktree — and `history` and `plot` read the records back along
// the commit timeline.

import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"
import {
  bool,
  type Check,
  code,
  type Command,
  type Context,
  CONTRACT,
  DATA_FILE,
  DEFAULT_DATA,
  type ExtensionPoint,
  type Finding,
  type Item,
  label,
  NO_PROGRESS,
  parse,
  type Plugin,
  positiveInt,
  type Progress,
  progressFor,
  rendered,
  str,
  type SummarySection,
  table,
  usageError,
  writeFileAtomic,
  writeJson,
} from "../../core/api.ts"
import {
  builtinLanguages,
  builtinMeasures,
  type CodeMeasure,
  type CodeSource,
  commitSource,
  type Language,
  selectFiles,
  STATISTICS,
  workingTreeSource,
} from "./code.ts"
import { htmlReport, plotSvg, REPORT_CSS, selectionPage, type Series } from "./plot.ts"
import { PRESETS } from "./presets.ts"

export type { CodeMeasure, CodeSource, FunctionInfo, Language } from "./code.ts"
export type { Series } from "./plot.ts"

/** What a run of a metric's command left: what every kind reads its number from. */
export interface RunOutput {
  /** The exit code; -1 when the program could not be started. */
  exit: number
  stdout: string
  stderr: string
  /** Wall-clock seconds the command took. */
  seconds: number
}

/** How a number is read from a run: what any plugin contributes to the `metric-kinds` point. */
export interface MetricKind {
  id: string
  says: string
  /** The number, or why there is none. Exit codes other than 0 are refused before it is asked, unless the kind reads them. */
  read(run: RunOutput, metric: MetricConfig): number | { error: string }
  /** True for a kind whose number is the exit code: a failing command is its measurement, not an error. */
  readsExit?: boolean
}

export interface MetricConfig {
  says?: string
  /** The command: a program and its arguments. `{tmp}` in an argument is a fresh temporary path, the same for `prepare`. */
  run?: string[]
  /** A command run first, whose exit must be 0: the test run a coverage report reads. */
  prepare?: string[]
  /** Instead of run: a code measure, taken in process. */
  measure?: string
  /** The preset the metric was declared with. */
  preset?: string
  /** For a measure: the languages it reads (default every programming language), and the paths it reads or leaves out. */
  language?: string | string[]
  include?: string[]
  exclude?: string[]
  /** For function-size and complexity: mean, median, p90, max or sum. */
  statistic?: string
  /** For duplication: how many consecutive lines make a duplicate. */
  window?: number
  /** For kind json: the dotted path to the number; an array there counts its entries. */
  field?: string
  /** How a change reads: a higher number is better, a lower one, or neither. */
  better?: "higher" | "lower" | "neither"
  kind?: string
  /** For kinds number and count: a regular expression; number reads its first group, count counts its matching lines. */
  pattern?: string
  unit?: string
  atMost?: number
  atLeast?: number
  equals?: number
  ratchet?: boolean
  tolerance?: number
  /** The id of the item that says why the bound was last loosened. */
  because?: string
}

/** A metric as the `metrics` point holds it: its name, its configuration, and the program it starts. */
export interface MetricDef extends MetricConfig {
  name: string
  /** The programs the launcher must let it start: the first word of `run` and of `prepare`; none for a measure. */
  runs: string[]
  configured: true
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const NAME = /^[a-z0-9][a-z0-9._-]*$/
const BOUNDS = ["atMost", "atLeast", "equals"] as const
type Bound = typeof BOUNDS[number]

const FIRST_NUMBER = /(-?\d+(?:\.\d+)?)/

/** The kinds the program ships. */
export const builtinKinds: MetricKind[] = [
  {
    id: "exit",
    says: "the command's exit code: 0 is a pass; with no bound it must equal 0",
    readsExit: true,
    read: (r) => (r.exit < 0 ? { error: "the program could not be started" } : r.exit),
  },
  {
    id: "number",
    says: "the first group of `pattern` in the output, stdout then stderr — with no pattern, the first number",
    read: (r, m) => {
      const text = `${r.stdout}\n${r.stderr}`
      const found = text.match(m.pattern ? new RegExp(m.pattern, "m") : FIRST_NUMBER)
      const value = found ? Number(found[1] ?? found[0]) : NaN
      return Number.isFinite(value) ? value : { error: `no number in the output${m.pattern ? ` matching /${m.pattern}/` : ""}` }
    },
  },
  {
    id: "count",
    says: "how many lines of the output match `pattern` (every non-blank line, with none): warnings, findings, files",
    readsExit: true,
    read: (r, m) => {
      const re = m.pattern ? new RegExp(m.pattern) : /\S/
      return `${r.stdout}\n${r.stderr}`.split(/\r?\n/).filter((l) => re.test(l)).length
    },
  },
  {
    id: "duration",
    says: "how many seconds the command took, wall clock",
    read: (r) => Math.round(r.seconds * 1000) / 1000,
  },
  {
    id: "json",
    says: "the number at `field`, a dotted path, in the JSON the command prints — an array there counts its entries: `deno lint --json`'s diagnostics",
    readsExit: true,
    read: (r, m) => {
      if (r.exit < 0) return { error: "the program could not be started" }
      let v: unknown
      try {
        v = JSON.parse(r.stdout)
      } catch {
        return { error: `the output is not JSON (exit ${r.exit})` }
      }
      for (const k of (m.field ?? "").split(".").filter(Boolean)) v = isObject(v) || Array.isArray(v) ? (v as Record<string, unknown>)[k] : undefined
      if (Array.isArray(v)) return v.length
      return typeof v === "number" && Number.isFinite(v) ? v : { error: `no number at ${m.field ? `"${m.field}"` : "the top"} of the JSON` }
    },
  },
]

/** The point this plugin declares for how numbers are read. */
export const kindsPoint: ExtensionPoint<MetricKind> = {
  id: "metric-kinds",
  says: "how a metric's number is read from its run: `read({ exit, stdout, stderr, seconds }, metric) → number | { error }`, `readsExit`",
  noun: "metric kind",
  stored: true,
  key: (k) => k.id,
  renamed: (k, id) => ({ ...k, id }),
  validate: (v) => {
    const k = v as Partial<MetricKind> | null
    if (!k || typeof k !== "object" || typeof k.id !== "string") return "has no id"
    return typeof k.read === "function" ? null : "has no read function"
  },
  gaps: (k) => (typeof k.says === "string" && k.says.trim() ? [] : ["does not say what it reads"]),
  document: (ks) => ["", "**Metric kinds**, how `naima metrics` reads a number", ...table(["Kind", "What it reads"], ks.map((k) => [code(k.id), k.says]))],
}

/** The point for code-quality numbers taken in process: any plugin may add one. */
export const measuresPoint: ExtensionPoint<CodeMeasure> = {
  id: "code-measures",
  says: "a code-quality number taken in process from the files: `measure({ files, source }, metric) → number | { error }`, with its `unit` and `better`",
  noun: "code measure",
  stored: true,
  key: (m) => m.id,
  renamed: (m, id) => ({ ...m, id }),
  validate: (v) => {
    const m = v as Partial<CodeMeasure> | null
    if (!m || typeof m !== "object" || typeof m.id !== "string") return "has no id"
    return typeof m.measure === "function" ? null : "has no measure function"
  },
  gaps: (m) => (typeof m.says === "string" && m.says.trim() ? [] : ["does not say what it measures"]),
  document: (ms) => [
    "",
    "**Code measures**, taken in process by a metric's `measure`",
    ...table(["Measure", "Unit", "Better", "What it measures"], ms.map((m) => [code(m.id), m.unit, m.better, m.says])),
  ],
}

/** The point for the languages code measures read: their files, comments, and functions. */
export const languagesPoint: ExtensionPoint<Language> = {
  id: "code-languages",
  says:
    "a language code measures read: `extensions`, `code`, `comments`, `quotes`, and `functions(stripped) → [{ name, line, lines, complexity }]` when it can find them",
  noun: "code language",
  stored: true,
  key: (l) => l.id,
  renamed: (l, id) => ({ ...l, id }),
  validate: (v) => {
    const l = v as Partial<Language> | null
    if (!l || typeof l !== "object" || typeof l.id !== "string") return "has no id"
    return Array.isArray(l.extensions) && l.extensions.length ? null : "has no extensions"
  },
  document: (ls) => [
    "",
    "**Code languages**, read by the code measures",
    ...table(["Language", "Files", "Functions and complexity"], ls.map((l) => [code(l.id), l.extensions.join(" "), l.functions ? "yes" : ""])),
  ],
}

/** The point the project's metrics stand on: `naima runs` and the launcher read the programs they start from it. */
export const metricsPoint: ExtensionPoint<MetricDef> = {
  id: "metrics",
  says: "a named measurement: `run` (a program and its arguments) and `kind`, or a code `measure`; a bound — `atMost`, `atLeast` or `equals` — and `better`",
  noun: "metric",
  stored: true,
  key: (m) => m.name,
  renamed: (m, name) => ({ ...m, name }),
  validate: (v) =>
    isObject(v) && typeof v["name"] === "string" && (Array.isArray(v["run"]) || typeof v["measure"] === "string") ? null : "has no name, run or measure",
  configured: () => true,
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

const COMMAND = (at: string, key: string, raw: unknown): void => {
  if (!Array.isArray(raw) || !raw.length || !raw.every((w) => typeof w === "string" && w.length)) {
    throw new Error(`${at}: ${key} is the command as a list, the program first: ["deno", "task", "test"]`)
  }
  if (!/^[^\s,]+$/.test(raw[0] as string)) throw new Error(`${at}: the program, ${JSON.stringify(raw[0])}, has a space or a comma`)
}

/** The project's metrics, as its naima.json says them, each preset filled in; throws on a malformed one, naming it. */
export function readMetrics(options: Record<string, unknown>): Record<string, MetricConfig> {
  const metrics = options["metrics"] ?? {}
  if (!isObject(metrics)) throw new Error("metrics: options.metrics must be an object")
  const out: Record<string, MetricConfig> = {}
  for (const [name, given] of Object.entries(metrics)) {
    const at = `metrics: metric "${name}"`
    if (!NAME.test(name)) throw new Error(`${at}: a name is lowercase letters, digits, dots, dashes and underscores`)
    if (!isObject(given)) throw new Error(`${at} must be an object`)
    const preset = given["preset"]
    if (preset !== undefined && (typeof preset !== "string" || !Object.hasOwn(PRESETS, preset))) {
      throw new Error(`${at}: no preset ${JSON.stringify(preset)} — presets: ${Object.keys(PRESETS).join(", ")}`)
    }
    const base = typeof preset === "string" ? PRESETS[preset] : undefined
    // A preset's command and measure give way to the one the metric names itself.
    const fromPreset: Record<string, unknown> = base ? { ...base } : {}
    if (given["run"] !== undefined || given["measure"] !== undefined) {
      delete fromPreset["run"]
      delete fromPreset["prepare"]
      delete fromPreset["measure"]
      if (given["run"] !== undefined) {
        delete fromPreset["statistic"]
      }
    }
    const raw: Record<string, unknown> = { ...fromPreset, ...given }
    if (raw["run"] !== undefined && raw["measure"] !== undefined) throw new Error(`${at}: run or measure, not both`)
    if (raw["measure"] === undefined) COMMAND(at, "run", raw["run"])
    else if (typeof raw["measure"] !== "string") throw new Error(`${at}: measure is the name of a code measure: loc, complexity, …`)
    if (raw["prepare"] !== undefined) COMMAND(at, "prepare", raw["prepare"])
    for (const key of ["says", "kind", "pattern", "unit", "because", "statistic", "field"]) {
      if (raw[key] !== undefined && typeof raw[key] !== "string") throw new Error(`${at}: ${key} is a string`)
    }
    for (const key of ["include", "exclude"]) {
      if (raw[key] !== undefined && !(Array.isArray(raw[key]) && raw[key].every((p) => typeof p === "string"))) {
        throw new Error(`${at}: ${key} is a list of paths or patterns: ["src", "**/*.test.ts"]`)
      }
    }
    const lang = raw["language"]
    if (lang !== undefined && typeof lang !== "string" && !(Array.isArray(lang) && lang.every((l) => typeof l === "string"))) {
      throw new Error(`${at}: language is a language's id, or a list of them: "typescript"`)
    }
    if (raw["statistic"] !== undefined && !(STATISTICS as readonly unknown[]).includes(raw["statistic"])) {
      throw new Error(`${at}: statistic is one of ${STATISTICS.join(", ")}`)
    }
    if (raw["better"] !== undefined && !["higher", "lower", "neither"].includes(raw["better"] as string)) {
      throw new Error(`${at}: better is higher, lower or neither`)
    }
    if (raw["window"] !== undefined && !(Number.isInteger(raw["window"]) && (raw["window"] as number) >= 2)) {
      throw new Error(`${at}: window is a whole number, 2 or more`)
    }
    if (typeof raw["pattern"] === "string") {
      try {
        new RegExp(raw["pattern"])
      } catch {
        throw new Error(`${at}: pattern is not a regular expression`)
      }
    }
    const bounds = BOUNDS.filter((b) => raw[b] !== undefined)
    if (bounds.length > 1) throw new Error(`${at}: one bound at most — ${bounds.join(", ")} given`)
    for (const b of [...bounds, "tolerance"]) if (raw[b] !== undefined && !num(raw[b])) throw new Error(`${at}: ${b} is a number`)
    if (num(raw["tolerance"]) && raw["tolerance"] < 0) throw new Error(`${at}: tolerance is not negative`)
    if (raw["ratchet"] !== undefined && typeof raw["ratchet"] !== "boolean") throw new Error(`${at}: ratchet is true or false`)
    if (raw["ratchet"] === true && !num(raw["atMost"]) && !num(raw["atLeast"])) {
      throw new Error(`${at}: ratchet needs a budget (atMost) or a floor (atLeast) to move`)
    }
    out[name] = raw as MetricConfig
  }
  return out
}

/** Which way is better for a metric: as it says, or as its bound implies — a budget lower, a floor higher. */
export function betterOf(m: MetricConfig): "higher" | "lower" | "neither" {
  if (m.better) return m.better
  return num(m.atMost) ? "lower" : num(m.atLeast) ? "higher" : "neither"
}

/** The bound a metric is held to, if any: kind exit with none must equal 0. */
export function boundOf(m: MetricConfig): { bound: Bound; value: number } | null {
  for (const b of BOUNDS) if (num(m[b])) return { bound: b, value: m[b] }
  return m.measure === undefined && (m.kind ?? "exit") === "exit" ? { bound: "equals", value: 0 } : null
}

const BOUND_WORD: Record<Bound, string> = { atMost: "budget", atLeast: "floor", equals: "baseline" }

/** A bound in words: "budget 120 s". */
export const boundText = (m: MetricConfig): string => {
  const b = boundOf(m)
  return b ? `${BOUND_WORD[b.bound]} ${b.value}${m.unit ? ` ${m.unit}` : ""}` : "no bound"
}

export interface Judgement {
  holds: boolean
  /** What it says about the number against its bound. */
  why: string
  /** For a ratchet: the value the bound must move to. */
  moveTo?: number
}

/** A number against its metric's bound: within it, past it, or — a ratchet — a gain the bound has not followed. */
export function judge(m: MetricConfig, value: number): Judgement {
  const b = boundOf(m)
  if (!b) return { holds: true, why: "recorded, no bound" }
  const slack = m.tolerance ?? 0
  const word = BOUND_WORD[b.bound]
  if (b.bound === "equals") {
    return Math.abs(value - b.value) <= slack ? { holds: true, why: `equals the ${word}` } : { holds: false, why: `differs from the ${word} ${b.value}` }
  }
  const over = b.bound === "atMost" ? value - b.value : b.value - value
  if (over > slack) return { holds: false, why: `past the ${word} ${b.value}` }
  if (m.ratchet && -over > slack) {
    const verb = b.bound === "atMost" ? "lower" : "raise"
    return { holds: false, why: `a gain the ${word} ${b.value} has not followed: ${verb} it`, moveTo: value }
  }
  return { holds: true, why: `within the ${word}` }
}

/** Does setting `to` loosen the bound — a budget up, a floor down, a baseline moved? Loosening needs an item saying why. */
export function loosens(m: MetricConfig, to: number): boolean {
  const b = boundOf(m)
  if (!b || !BOUNDS.some((k) => num(m[k]))) return false
  return b.bound === "atMost" ? to > b.value : b.bound === "atLeast" ? to < b.value : to !== b.value
}

export const DIR = "metrics"

/** One run of the gate set, as recorded. */
export interface MetricRecord {
  commit: string
  /** True when the work had changes not committed: the numbers are of the commit and those changes. */
  dirty: boolean
  /** When the record was made. */
  at: string
  /** The commit's own date (committer date): where it stands on the timeline. */
  date?: string
  /** True for a record `naima metrics backfill` made of a past commit. */
  backfill?: boolean
  values: Record<string, { value: number | null; exit: number; holds: boolean }>
}

const git = (ctx: Context, ...args: string[]): string | null => {
  const r = spawnSync("git", args, { cwd: ctx.root, encoding: "utf8" })
  return r.status === 0 ? r.stdout.trim() : null
}

const recordsDir = (ctx: Context): string => join(ctx.trackerRoot, DIR)

/** Every record in the data directory. */
export function readRecords(ctx: Context): MetricRecord[] {
  const dir = recordsDir(ctx)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => {
    try {
      const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as MetricRecord
      return typeof r.commit === "string" && isObject(r.values) ? [r] : []
    } catch {
      return []
    }
  })
}

/** The line of history up to HEAD, oldest first, with each commit's date. */
function line(ctx: Context): { commit: string; date: string }[] {
  return (git(ctx, "log", "--reverse", "--format=%H %cI", "HEAD") ?? "").split("\n").filter(Boolean).map((l) => {
    const [commit = "", date = ""] = l.split(" ")
    return { commit, date }
  })
}

/** Each commit's latest record of the line of history, oldest commit first: a commit off this line (another branch's) is not on it. */
function latestOnLine(ctx: Context): { commit: string; date: string; record: MetricRecord }[] {
  const latest = new Map<string, MetricRecord>()
  for (const r of readRecords(ctx)) {
    const prior = latest.get(r.commit)
    if (!prior || prior.at < r.at) latest.set(r.commit, r)
  }
  return line(ctx).flatMap((c) => {
    const record = latest.get(c.commit)
    return record ? [{ ...c, record }] : []
  })
}

/**
 * The line of history up to HEAD, oldest first, and each commit's latest record of `name`: the trend.
 * A record of a commit off this line (another branch's) is not on it.
 */
export function history(ctx: Context, name: string): { commit: string; at: string; date: string; value: number; dirty: boolean }[] {
  const latest = new Map<string, MetricRecord>()
  for (const r of readRecords(ctx)) {
    if (!r.values[name] || typeof r.values[name].value !== "number") continue
    const prior = latest.get(r.commit)
    if (!prior || prior.at < r.at) latest.set(r.commit, r)
  }
  return line(ctx).flatMap((c) => {
    const r = latest.get(c.commit)
    const v = r?.values[name]?.value
    return r && typeof v === "number" ? [{ commit: c.commit, at: r.at, date: r.date ?? c.date, value: v, dirty: r.dirty }] : []
  })
}

/** The metrics' values along the line of history: one row per commit with a record of any of them, oldest first. */
export function historyTable(ctx: Context, names: string[], last?: number): { commit: string; date: string; values: Record<string, number | null> }[] {
  const per = new Map(names.map((n) => [n, new Map(history(ctx, n).map((h) => [h.commit, h]))]))
  const rows = line(ctx).flatMap((c) => {
    const values: Record<string, number | null> = {}
    let any = false
    for (const n of names) {
      const h = per.get(n)?.get(c.commit)
      values[n] = h ? h.value : null
      any ||= !!h
    }
    return any ? [{ commit: c.commit, date: c.date, values }] : []
  })
  return last === undefined ? rows : rows.slice(-last)
}

/** The number a new measurement of `name` is compared to: the last one recorded on an earlier commit of this line, or none. */
export function baselineOf(ctx: Context, name: string, head: string | null): number | undefined {
  return history(ctx, name).filter((h) => h.commit !== head).at(-1)?.value
}

const kindOf = (ctx: Context, id: string): MetricKind | undefined => ctx.registry.find<MetricKind>("metric-kinds", id)?.value
const measureOf = (ctx: Context, id: string): CodeMeasure | undefined => ctx.registry.find<CodeMeasure>("code-measures", id)?.value
const languagesOf = (ctx: Context): Language[] => ctx.registry.contributions("code-languages").map((c) => c.value as Language)
const metricsOf = (ctx: Context): MetricDef[] => ctx.registry.contributions("metrics").map((c) => c.value as MetricDef)

/** Where a measurement is taken: the tree its commands run in and the files its code measures read. Runs shared by metrics with the same command are made once. */
export interface Site {
  root: string
  source: () => CodeSource
  runs: Map<string, RunOutput>
}

/** The working tree, as `naima metrics run` measures it: its files as they are, uncommitted changes included. */
export function workingSite(ctx: Context): Site {
  let source: CodeSource | undefined
  return { root: ctx.root, source: () => (source ??= workingTreeSource(ctx.root, [ctx.trackerDir])), runs: new Map() }
}

// deno-lint-ignore no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g

/** Run a command in `cwd`, colour off, its output stripped of escape codes. */
function runCommand(program: string, args: string[], cwd: string): RunOutput & { error?: Error } {
  const start = performance.now()
  const r = spawnSync(program, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } })
  return {
    exit: r.error ? -1 : r.status ?? -1,
    stdout: (r.stdout ?? "").replace(ANSI, ""),
    stderr: (r.stderr ?? "").replace(ANSI, ""),
    seconds: (performance.now() - start) / 1000,
    ...(r.error ? { error: r.error } : {}),
  }
}

/** A metric's `prepare` and `run`, made once per site: `{tmp}` is a fresh temporary path, the same for both. */
function runOf(m: MetricConfig, site: Site): RunOutput & { error?: Error; failed?: string } {
  const key = JSON.stringify([m.prepare ?? null, m.run])
  const cached = site.runs.get(key)
  if (cached) return cached
  const tmp = join(tmpdir(), `naima-metric-${randomUUID().slice(0, 8)}`)
  const fill = (args: string[]) => args.map((a) => a.replaceAll("{tmp}", tmp))
  let out: RunOutput & { error?: Error; failed?: string }
  try {
    if (m.prepare) {
      const [p, ...a] = fill(m.prepare)
      const r = runCommand(p as string, a, site.root)
      if (r.exit !== 0) {
        const tail = `${r.stderr}${r.stdout}`.trim().split("\n").slice(-3).join(" | ")
        out = { ...r, failed: r.error ? `${p} could not be started: ${r.error.message}` : `prepare exited ${r.exit}${tail ? `: ${tail}` : ""}` }
        site.runs.set(key, out)
        return out
      }
    }
    const [program, ...args] = fill(m.run ?? [])
    out = runCommand(program as string, args, site.root)
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {
      // a temporary path outside what the program may write: the system's to clean
    }
  }
  site.runs.set(key, out)
  return out
}

/** Take a metric's number: run its command in the site's tree and read it, or take its code measure from the site's files. */
export function measure(ctx: Context, m: MetricDef, site: Site = workingSite(ctx)): { value: number | null; exit: number; error?: string } {
  if (m.measure !== undefined) {
    const cm = measureOf(ctx, m.measure)
    if (!cm) return { value: null, exit: -1, error: `no code measure "${m.measure}"` }
    try {
      const source = site.source()
      const files = selectFiles(source, languagesOf(ctx), m)
      const read = cm.measure({ files, source }, m)
      return typeof read === "number" ? { value: read, exit: 0 } : { value: null, exit: 0, error: read.error }
    } catch (e) {
      return { value: null, exit: -1, error: (e as Error).message }
    }
  }
  const kind = kindOf(ctx, m.kind ?? "exit")
  if (!kind) return { value: null, exit: -1, error: `no metric kind "${m.kind}"` }
  const run = runOf(m, site)
  if (run.failed) return { value: null, exit: run.exit, error: run.failed }
  if (run.exit !== 0 && !kind.readsExit) {
    const tail = `${run.stderr}${run.stdout}`.trim().split("\n").slice(-3).join(" | ")
    return {
      value: null,
      exit: run.exit,
      error: run.error ? `${m.run?.[0]} could not be started: ${run.error.message}` : `exited ${run.exit}${tail ? `: ${tail}` : ""}`,
    }
  }
  const read = kind.read(run, m)
  return typeof read === "number" ? { value: read, exit: run.exit } : { value: null, exit: run.exit, error: read.error }
}

/** What a metric measures with, in words: its command, or its code measure and selection. */
export function measuredBy(m: MetricConfig): string {
  if (m.measure === undefined) return [m.prepare ? `${m.prepare.join(" ")} &&` : "", (m.run ?? []).join(" ")].filter(Boolean).join(" ")
  const sel = [
    m.statistic,
    m.language === undefined ? "" : [m.language].flat().join("+"),
    m.include?.length ? `in ${m.include.join(", ")}` : "",
    m.exclude?.length ? `not ${m.exclude.join(", ")}` : "",
  ].filter(Boolean)
  return `in process: ${m.measure}${sel.length ? `, ${sel.join(", ")}` : ""}`
}

const fmt = (n: number | undefined, unit?: string): string => (n === undefined ? "none" : `${n}${unit ? ` ${unit}` : ""}`)
const delta = (now: number, was: number | undefined): string => {
  if (was === undefined) return ""
  const d = Math.round((now - was) * 1000) / 1000
  return d === 0 ? ", unchanged" : `, ${d > 0 ? "+" : ""}${d}`
}

const find = (ctx: Context, name: string | undefined): MetricDef => {
  const m = metricsOf(ctx).find((x) => x.name === name)
  if (!m) throw new Error(`no metric "${name}" — metrics: ${metricsOf(ctx).map((x) => x.name).join(", ") || "none declared yet"}`)
  return m
}

/** The data file, read and written as the next load reads it. */
const DATA_PATH = (ctx: Context): string => join(ctx.trackerRoot, DATA_FILE)

function writeBound(ctx: Context, name: string, value: number, because: Item | undefined): void {
  const raw = JSON.parse(readFileSync(DATA_PATH(ctx), "utf8")) as Record<string, unknown>
  const plugins = isObject(raw["plugins"]) ? raw["plugins"] : {}
  const entry = isObject(plugins["metrics"]) ? plugins["metrics"] : {}
  const options = isObject(entry["options"]) ? entry["options"] : {}
  const metrics = isObject(options["metrics"]) ? options["metrics"] : {}
  const current = metrics[name]
  if (!isObject(current)) throw new Error(`metric "${name}" is not declared in ${ctx.trackerDir}/${DATA_FILE}`)
  const bound = BOUNDS.find((b) => num(current[b]))
  if (!bound) throw new Error(`metric "${name}" has no bound to move — give it atMost, atLeast or equals in ${ctx.trackerDir}/${DATA_FILE}`)
  const { because: _was, ...rest } = current
  const next = { ...rest, [bound]: value, ...(because ? { because: because.meta.id } : {}) }
  const nextOptions = { ...options, metrics: { ...metrics, [name]: next } }
  readMetrics(nextOptions)
  writeJson(DATA_PATH(ctx), { ...raw, plugins: { ...plugins, metrics: { ...entry, options: nextOptions } } })
}

/** Eight blocks for a trend at a glance. */
const SPARK = "▁▂▃▄▅▆▇█"
export function sparkline(values: number[]): string {
  const lo = Math.min(...values), hi = Math.max(...values)
  return values.map((v) => SPARK[hi === lo ? 3 : Math.round(((v - lo) / (hi - lo)) * 7)]).join("")
}

/** A record of the numbers taken at a site, each judged against its bound. */
function takeAll(
  ctx: Context,
  wanted: MetricDef[],
  site: Site,
  progress: Progress = NO_PROGRESS,
  counted = true,
): { values: MetricRecord["values"]; errors: Map<string, string> } {
  const values: MetricRecord["values"] = {}
  const errors = new Map<string, string>()
  for (const [i, m] of wanted.entries()) {
    // The metrics taken of those asked, the stage named by the one being taken (specs/progress-long-work-says-how-far, §6).
    if (counted) progress.overall(i, wanted.length, "metrics")
    progress.stage(m.name)
    const r = measure(ctx, m, site)
    if (r.value === null) {
      values[m.name] = { value: null, exit: r.exit, holds: false }
      errors.set(m.name, r.error ?? "no number")
    } else values[m.name] = { value: r.value, exit: r.exit, holds: judge(m, r.value).holds }
  }
  return { values, errors }
}

const writeRecord = (ctx: Context, record: MetricRecord): string => {
  mkdirSync(recordsDir(ctx), { recursive: true })
  const file = `${record.commit}-${randomUUID().slice(0, 8)}.json`
  writeJson(join(recordsDir(ctx), file), record)
  return file
}

const commitDate = (ctx: Context, commit: string): string | undefined => git(ctx, "log", "-1", "--format=%cI", commit) ?? undefined

/**
 * Measure past commits of the first-parent line and record each: code measures read the commit from git's
 * objects; commands run in one temporary worktree, checked out at each commit in turn and removed at the end.
 * The working tree is never touched. A commit already recorded for every wanted metric is skipped.
 */
export function backfill(
  ctx: Context,
  wanted: MetricDef[],
  opts: { since?: string; last?: number; every?: number; again?: boolean },
  progress: Progress = NO_PROGRESS,
): { recorded: { commit: string; values: MetricRecord["values"]; errors: Map<string, string> }[]; skipped: number } {
  const range = opts.since ? `${opts.since}..HEAD` : "HEAD"
  const all = (git(ctx, "rev-list", "--first-parent", "--reverse", range) ?? "").split("\n").filter(Boolean)
  const limited = opts.last !== undefined || !opts.since ? all.slice(-(opts.last ?? 30)) : all
  const every = opts.every ?? 1
  const picked = limited.filter((_, i) => (limited.length - 1 - i) % every === 0)
  const have = new Map<string, Set<string>>()
  for (const r of readRecords(ctx)) {
    const s = have.get(r.commit) ?? new Set<string>()
    for (const [n, v] of Object.entries(r.values)) if (typeof v.value === "number") s.add(n)
    have.set(r.commit, s)
  }
  const todo = opts.again ? picked : picked.filter((c) => !wanted.every((m) => have.get(c)?.has(m.name)))
  const recorded: { commit: string; values: MetricRecord["values"]; errors: Map<string, string> }[] = []
  if (!todo.length) return { recorded, skipped: picked.length }
  const needsTree = wanted.some((m) => m.measure === undefined)
  const tree = join(tmpdir(), `naima-backfill-${randomUUID().slice(0, 8)}`)
  if (needsTree && git(ctx, "worktree", "add", "--detach", "--quiet", tree, todo[0] as string) === null) {
    throw new Error(`could not make a temporary worktree at ${tree} — git worktree add failed`)
  }
  try {
    for (const [i, commit] of todo.entries()) {
      // The commits measured of those to measure (specs/progress-long-work-says-how-far, §6).
      progress.overall(i, todo.length, "commits")
      if (needsTree) {
        const at = (...args: string[]) => spawnSync("git", ["-C", tree, ...args], { encoding: "utf8" }).status === 0
        if (!at("checkout", "--quiet", "--detach", "--force", commit) || !at("clean", "-q", "-ffdx")) {
          throw new Error(`could not check out ${commit} in ${tree}`)
        }
      }
      let source: CodeSource | undefined
      const site: Site = { root: tree, source: () => (source ??= commitSource(ctx.root, commit, [ctx.trackerDir])), runs: new Map() }
      const { values, errors } = takeAll(ctx, wanted, site, progress, false)
      const date = commitDate(ctx, commit)
      writeRecord(ctx, { commit, dirty: false, at: ctx.now().toISOString(), ...(date ? { date } : {}), backfill: true, values })
      recorded.push({ commit, values, errors })
    }
  } finally {
    if (needsTree) {
      git(ctx, "worktree", "remove", "--force", tree)
      git(ctx, "worktree", "prune")
    }
  }
  return { recorded, skipped: picked.length - todo.length }
}

/** A metric's points as the plot draws them. */
export function seriesOf(ctx: Context, m: MetricDef, last?: number): Series {
  const h = history(ctx, m.name)
  const pts = (last === undefined ? h : h.slice(-last)).map((x) => ({ commit: x.commit, date: x.date, value: x.value }))
  const b = boundOf(m)
  const unit = m.unit ?? (m.measure ? measureUnit(m.measure) : undefined)
  return {
    name: m.name,
    ...(m.says ? { says: m.says } : {}),
    ...(unit ? { unit } : {}),
    better: betterOf(m),
    ...(b && BOUNDS.some((k) => num(m[k])) ? { bound: { word: BOUND_WORD[b.bound], value: b.value } } : {}),
    points: pts,
  }
}

/** A view of `naima ui`: the shape the `ui-views` point takes, declared here since plugins never import each other. */
interface UiView {
  name: string
  title: string
  says: string
  render(params: Record<string, string[]>, ctx: Context): { data: unknown; html: string; css?: string }
}

/**
 * The metrics, picked and over a range of commits, as `naima ui` shows them: rendered from the records at each
 * request. `metric` names the metrics (all when absent), `from` and `to` the first and last commit, by any prefix.
 */
export const metricsView: UiView = {
  name: "metrics",
  title: "Metrics",
  says: "the project's metrics along the commit timeline: a chart and a table of each, for the metrics and the commits picked",
  render(params, ctx) {
    const all = metricsOf(ctx)
    const wanted = params["metric"]?.filter((n) => all.some((m) => m.name === n)) ?? []
    const picked = wanted.length ? all.filter((m) => wanted.includes(m.name)) : all
    const commits = historyTable(ctx, all.map((m) => m.name)).map(({ commit, date }) => ({ commit, date }))
    const at = (ref: string | undefined, fallback: number): number => {
      const i = ref ? commits.findIndex((c) => c.commit.startsWith(ref)) : -1
      return i < 0 ? fallback : i
    }
    let lo = at(params["from"]?.[0], 0)
    let hi = at(params["to"]?.[0], commits.length - 1)
    if (lo > hi) [lo, hi] = [hi, lo]
    const inRange = new Set(commits.slice(lo, hi + 1).map((c) => c.commit))
    const series = picked.map((m) => {
      const s = seriesOf(ctx, m)
      return { ...s, points: s.points.filter((p) => inRange.has(p.commit)) }
    })
    const from = commits[lo]?.commit
    const to = commits[hi]?.commit
    const sel = {
      metrics: all.map((m) => ({ name: m.name, ...(m.says ? { says: m.says } : {}) })),
      picked: picked.map((m) => m.name),
      commits,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }
    return { data: { ...sel, series }, html: selectionPage(sel, series), css: REPORT_CSS }
  },
}

const measureUnit = (id: string): string | undefined => builtinMeasures.find((x) => x.id === id)?.unit || undefined

const csvCell = (v: string | number | null): string => (v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

const outPath = (file: string): string => (isAbsolute(file) ? file : resolve(file))

const metricsCommand: Command = {
  name: "metrics",
  says:
    "the project's metrics — each a name and the command or code measure that takes it — run, recorded per commit, held to a budget, a floor or a baseline, and read back along the commit timeline as a trend, a table or a chart; every number with the one it is compared to",
  enforces:
    "numbers are recorded with the commit they measure; a ratcheted bound only tightens, and loosening one is refused without --because naming the item that says why",
  long: {
    reports:
      "run: the metrics taken of those asked, each a stage named by its metric; backfill: the commits measured of those to measure; a metric's own command reports nothing while it runs, so the count moves between metrics",
  },
  usage:
    "metrics [list] | metrics run [name...] [--record] | metrics bound <name> <value> [--because <item>] | metrics trend <name> | metrics history [name...] [--json | --csv] [--last <n>] | metrics backfill [name...] [--since <ref>] [--last <n>] [--every <n>] [--again] | metrics plot [name...] [--out <file>] [--html] [--last <n>] [--title <t>] | metrics presets [--json]",
  options: [
    { name: "--record", says: "run: write the numbers, with the commit they measure, to metrics/ in the data directory" },
    { name: "--because", says: "bound: the item that says why a bound is loosened — a budget raised, a floor lowered; refused without it" },
    { name: "--json", says: "history: one JSON list of commits, each with its date and values; presets: a ready declaration of every preset" },
    { name: "--csv", says: "history: comma-separated, one row per commit — commit, date, then each metric" },
    { name: "--last", says: "history and plot: only the last n commits recorded; backfill: the last n commits of the first-parent line (default 30)" },
    { name: "--since", says: "backfill: the commits after this ref, on the first-parent line up to HEAD" },
    { name: "--every", says: "backfill: every nth commit, counting back from HEAD, which is always measured" },
    { name: "--again", says: "backfill: measure commits already recorded too" },
    { name: "--out", says: "plot: write the chart to this file instead of printing it" },
    { name: "--html", says: "plot: a page with the chart and a table of where each metric started and where it is now, instead of the bare SVG" },
    { name: "--title", says: "plot: the chart's title" },
  ],
  examples: [
    "metrics",
    "metrics run --record",
    "metrics run tests coverage",
    "metrics bound test-time 140 --because bugs/slow-ci",
    "metrics trend tests",
    "metrics history --csv",
    "metrics backfill --last 50 --every 5",
    "metrics plot coverage complexity --last 50 --out quality.svg",
    "metrics plot --html --out quality.html",
    "metrics presets",
  ],
  run(args, ctx) {
    const p = parse(args, {
      record: { type: "boolean" },
      because: { type: "string" },
      json: { type: "boolean" },
      csv: { type: "boolean" },
      last: { type: "string" },
      since: { type: "string" },
      every: { type: "string" },
      again: { type: "boolean" },
      out: { type: "string" },
      html: { type: "boolean" },
      title: { type: "string" },
    })
    const [sub = "list", ...rest] = p.positionals
    const head = git(ctx, "rev-parse", "HEAD")
    const last = str(p, "last") === undefined ? undefined : positiveInt(str(p, "last"), 1, `metrics ${sub} --last`)
    const named = (): MetricDef[] => (rest.length ? rest.map((n) => find(ctx, n)) : metricsOf(ctx))
    if (sub === "list") {
      if (rest.length) throw usageError(this)
      const ms = metricsOf(ctx)
      if (!ms.length) {
        ctx.out(`no metrics declared — plugins.metrics.options.metrics in ${ctx.trackerDir}/${DATA_FILE}; naima metrics presets lists ready ones`)
        return 0
      }
      for (const m of ms) {
        const h = history(ctx, m.name)
        const lastValue = h.at(-1)
        const better = betterOf(m)
        ctx.out(
          `${m.name.padEnd(16)} ${m.measure === undefined ? m.kind ?? "exit" : "measure"}, ${boundText(m)}${m.ratchet ? ", ratchet" : ""}${
            better === "neither" ? "" : `, ${better} is better`
          }; last ${fmt(lastValue?.value, m.unit)}  — ${measuredBy(m)}`,
        )
      }
      return 0
    }
    if (sub === "run") {
      const wanted = named()
      if (!wanted.length) throw new Error(`no metrics declared — plugins.metrics.options.metrics in ${ctx.trackerDir}/${DATA_FILE}`)
      const dirty = (git(ctx, "status", "--porcelain", "--", ".", `:(exclude)${ctx.trackerDir}`) ?? "") !== ""
      const progress = progressFor((l) => ctx.err(l))
      let taken: ReturnType<typeof takeAll>
      try {
        taken = takeAll(ctx, wanted, workingSite(ctx), progress)
        progress.overall(wanted.length, wanted.length, "metrics")
      } finally {
        progress.end()
      }
      const { values, errors } = taken
      let failed = 0
      for (const m of wanted) {
        const v = values[m.name]!
        const was = baselineOf(ctx, m.name, head)
        if (v.value === null) {
          failed++
          ctx.out(`  ✗ ${m.name}: no number (was ${fmt(was, m.unit)}) — ${errors.get(m.name)}`)
          continue
        }
        const j = judge(m, v.value)
        if (!j.holds) failed++
        const move = j.moveTo !== undefined ? ` — naima metrics bound ${m.name} ${j.moveTo}` : ""
        ctx.out(
          `  ${j.holds ? "✓" : "✗"} ${m.name}: ${fmt(v.value, m.unit)} (was ${fmt(was, m.unit)}${delta(v.value, was)}; ${boundText(m)}) — ${j.why}${move}`,
        )
      }
      ctx.out(
        `${failed ? `${failed} of ${wanted.length} metrics fail` : `all ${wanted.length} metrics hold`} on ${head?.slice(0, 12) ?? "no commit"}${
          dirty ? " and uncommitted changes" : ""
        }`,
      )
      if (bool(p, "record")) {
        if (!head) throw new Error("nothing to record against: the repository has no commit yet")
        const date = commitDate(ctx, head)
        const file = writeRecord(ctx, { commit: head, dirty, at: ctx.now().toISOString(), ...(date ? { date } : {}), values })
        ctx.out(`wrote ${ctx.trackerDir}/${DIR}/${file} — commit it with the work it measures`)
      }
      return failed ? 1 : 0
    }
    if (sub === "bound") {
      const [name, raw] = rest
      if (!name || raw === undefined || rest.length > 2 || !Number.isFinite(Number(raw))) throw usageError(this)
      const m = find(ctx, name)
      const value = Number(raw)
      const ref = str(p, "because")
      const because = ref === undefined ? undefined : ctx.repo.resolve(ref)
      if (loosens(m, value) && !because) {
        throw new Error(`moving ${m.name}'s ${boundText(m)} to ${value} loosens it: name the item that says why — --because <item>`)
      }
      writeBound(ctx, m.name, value, because)
      ctx.out(`${m.name}: ${boundText(m)} → ${value}${because ? `, because ${label(because)}` : ""} — written to ${ctx.trackerDir}/${DATA_FILE}`)
      return 0
    }
    if (sub === "trend") {
      const [name] = rest
      if (!name || rest.length > 1) throw usageError(this)
      const m = find(ctx, name)
      const h = history(ctx, m.name)
      if (!h.length) {
        ctx.out(`${m.name}: nothing recorded on this line of history — naima metrics run --record, or naima metrics backfill`)
        return 0
      }
      ctx.out(`${m.name} (${boundText(m)}): ${sparkline(h.map((x) => x.value))}  ${fmt(h[0]?.value, m.unit)} → ${fmt(h.at(-1)?.value, m.unit)}`)
      h.forEach((x, i) =>
        ctx.out(
          `  ${x.commit.slice(0, 12)}  ${x.date.slice(0, 10)}  ${fmt(x.value, m.unit)}${delta(x.value, h[i - 1]?.value)}${
            x.dirty ? "  (uncommitted changes)" : ""
          }`,
        )
      )
      return 0
    }
    if (sub === "history") {
      if (bool(p, "json") && bool(p, "csv")) throw usageError(this)
      const names = named().map((m) => m.name)
      const rows = historyTable(ctx, names, last)
      if (bool(p, "json")) {
        ctx.out(JSON.stringify(rows.map((r) => ({ ...r, values: Object.fromEntries(Object.entries(r.values).filter(([, v]) => v !== null)) })), null, 2))
        return 0
      }
      if (bool(p, "csv")) {
        ctx.out(["commit", "date", ...names].map(csvCell).join(","))
        for (const r of rows) ctx.out([r.commit, r.date, ...names.map((n) => r.values[n] ?? null)].map(csvCell).join(","))
        return 0
      }
      if (!rows.length) {
        ctx.out("nothing recorded on this line of history — naima metrics run --record, or naima metrics backfill")
        return 0
      }
      const widths = names.map((n) => Math.max(n.length, ...rows.map((r) => String(r.values[n] ?? "").length)))
      ctx.out(["commit".padEnd(12), "date".padEnd(10), ...names.map((n, i) => n.padStart(widths[i]!))].join("  "))
      for (const r of rows) {
        ctx.out([r.commit.slice(0, 12), r.date.slice(0, 10), ...names.map((n, i) => String(r.values[n] ?? "·").padStart(widths[i]!))].join("  "))
      }
      return 0
    }
    if (sub === "backfill") {
      const wanted = named()
      if (!wanted.length) throw new Error(`no metrics declared — plugins.metrics.options.metrics in ${ctx.trackerDir}/${DATA_FILE}`)
      const every = str(p, "every") === undefined ? undefined : positiveInt(str(p, "every"), 1, "metrics backfill --every")
      const since = str(p, "since")
      const progress = progressFor((l) => ctx.err(l))
      let filled: ReturnType<typeof backfill>
      try {
        filled = backfill(ctx, wanted, {
          ...(since !== undefined ? { since } : {}),
          ...(last !== undefined ? { last } : {}),
          ...(every !== undefined ? { every } : {}),
          again: bool(p, "again"),
        }, progress)
      } finally {
        progress.end()
      }
      const { recorded, skipped } = filled
      for (const r of recorded) {
        const said = wanted.map((m) => {
          const v = r.values[m.name]?.value
          return `${m.name} ${v === null || v === undefined ? `— (${r.errors.get(m.name)})` : fmt(v, m.unit)}`
        })
        ctx.out(`  ${r.commit.slice(0, 12)}  ${said.join(", ")}`)
      }
      ctx.out(
        `backfilled ${recorded.length} commits${skipped ? `; ${skipped} already recorded` : ""}${
          recorded.length ? ` — wrote ${recorded.length} files in ${ctx.trackerDir}/${DIR}/: commit them` : ""
        }`,
      )
      return 0
    }
    if (sub === "plot") {
      const wanted = named()
      if (!wanted.length) throw new Error(`no metrics declared — plugins.metrics.options.metrics in ${ctx.trackerDir}/${DATA_FILE}`)
      const series = wanted.map((m) => seriesOf(ctx, m, last))
      const title = str(p, "title")
      const doc = bool(p, "html") ? htmlReport(series, title) : plotSvg(series, title)
      const file = str(p, "out")
      if (file === undefined) {
        ctx.out(doc)
        return 0
      }
      const path = outPath(file)
      try {
        writeFileAtomic(path, doc + "\n")
      } catch (e) {
        throw new Error(`could not write ${file}: ${(e as Error).message} — print it instead: naima metrics plot … > ${file}`)
      }
      ctx.out(`wrote ${file}: ${series.map((s) => `${s.name} (${s.points.length} commits)`).join(", ")}`)
      return 0
    }
    if (sub === "presets") {
      if (rest.length) throw usageError(this)
      if (bool(p, "json")) {
        ctx.out(JSON.stringify(Object.fromEntries(Object.keys(PRESETS).map((id) => [id, { preset: id }])), null, 2))
        return 0
      }
      for (const [id, pr] of Object.entries(PRESETS)) {
        const better = pr.better === "neither" ? "" : `; ${pr.better} is better`
        ctx.out(`  ${id.padEnd(24)} ${measuredBy(pr)}${pr.unit ? ` (${pr.unit})` : ""}${better} — ${pr.says}`)
      }
      ctx.out(
        `declare one: "<name>": { "preset": "<id>" } under plugins.metrics.options.metrics in ${ctx.trackerDir}/${DATA_FILE}; any key beside it overrides the preset's`,
      )
      return 0
    }
    throw usageError(this)
  },
}

/** Where every metric stands on the last commit recorded, against the one before and its bound: for summary, the board and the queue. */
export interface MetricStanding {
  metric: string
  value: number | null
  was: number | null
  unit?: string
  bound: string
  holds: boolean
  better: "higher" | "lower" | "neither"
  /** better, worse, unchanged, up or down: the change from the commit recorded before. */
  change: string | null
  trend: string
  commit: string
}

export function standings(ctx: Context): MetricStanding[] {
  const ms = metricsOf(ctx)
  if (!ms.length) return []
  const rows = latestOnLine(ctx)
  const lastRow = rows.at(-1)
  if (!lastRow) return []
  return ms.map((m) => {
    const h = history(ctx, m.name)
    const v = lastRow.record.values[m.name]
    const value = typeof v?.value === "number" ? v.value : null
    const prior = h.filter((x) => x.commit !== lastRow.commit).at(-1)
    const better = betterOf(m)
    const d = value === null || !prior ? null : Math.round((value - prior.value) * 1000) / 1000
    const change = d === null
      ? null
      : d === 0
      ? "unchanged"
      : better === "neither"
      ? (d > 0 ? "up" : "down")
      : (d > 0) === (better === "higher")
      ? "better"
      : "worse"
    return {
      metric: m.name,
      value,
      was: prior?.value ?? null,
      ...(m.unit ? { unit: m.unit } : {}),
      bound: boundText(m),
      holds: value !== null && judge(m, value).holds,
      better,
      change,
      trend: h.length > 1 ? sparkline(h.slice(-12).map((x) => x.value)) : "",
      commit: lastRow.commit,
    }
  })
}

const standingLine = (s: MetricStanding, width: number): string => {
  const was = s.was === null ? "" : `was ${fmt(s.was, s.unit)}, ${s.change}; `
  return `  ${s.holds ? "✓" : "✗"} ${s.metric.padEnd(width)}  ${s.value === null ? "no number" : fmt(s.value, s.unit)} (${was}${s.bound})${
    s.trend ? `  ${s.trend}` : ""
  }`
}

const summarySection: SummarySection = {
  name: "metrics",
  alongside: true,
  render(ctx) {
    const declared = metricsOf(ctx).length > 0
    const data = standings(ctx)
    return rendered(data, (rows) => {
      if (!declared) return []
      if (!rows.length) return ["  nothing recorded yet — naima metrics run --record"]
      const width = Math.max(...rows.map((r) => r.metric.length))
      return [...rows.map((r) => standingLine(r, width)), `  on ${rows[0]!.commit.slice(0, 12)} — naima metrics history, naima metrics plot`]
    })
  },
}

const boundReasons: Check = {
  name: "metric-bound-because",
  says: "a metric's `because` names an item of the tracker",
  run(ctx) {
    const out: Finding[] = []
    for (const m of metricsOf(ctx)) {
      if (m.because !== undefined && !ctx.repo.items.some((i) => i.meta.id === m.because)) {
        out.push({ level: "problem", message: `metric ${m.name}: because names ${m.because}, which is no item` })
      }
      if (m.measure !== undefined) {
        if (!measureOf(ctx, m.measure)) out.push({ level: "problem", message: `metric ${m.name}: no code measure "${m.measure}"` })
        continue
      }
      const kind = m.kind ?? "exit"
      if (!kindOf(ctx, kind)) out.push({ level: "problem", message: `metric ${m.name}: no metric kind "${kind}"` })
    }
    return out
  },
}

/** The gate this plugin contributes: the shape the gates point takes, declared here since plugins never import each other. */
interface Gate {
  name: string
  /** Declared by the project's configuration, not the program: the program's reference leaves it out. */
  configured: true
  title: string
  says: string
  decides: string
  evaluate(ctx: Context): { holds: boolean; blocking: Item[]; owed: Item[]; reasons: string[] }
}

export default function metrics(options: Record<string, unknown> = {}): Plugin {
  const declared = readMetrics(options)
  const defs: MetricDef[] = Object.entries(declared).map(([name, c]) => ({
    ...c,
    name,
    runs: [...new Set([c.run?.[0], c.prepare?.[0]].filter((x): x is string => typeof x === "string"))],
    configured: true,
  }))
  const gate: Gate = {
    name: "metrics",
    configured: true,
    title: "The project's metrics",
    says: "every declared metric held to its bound on the last record of HEAD's commit",
    decides:
      "holds when the latest record of HEAD's commit (naima metrics run --record) has every declared metric within its bound; with no record of HEAD, it holds only if no metric is declared. It blocks on no item: it says which number fails, and how far.",
    evaluate(ctx) {
      const ms = metricsOf(ctx)
      if (!ms.length) return { holds: true, blocking: [], owed: [], reasons: [] }
      const head = git(ctx, "rev-parse", "HEAD")
      const last = readRecords(ctx).filter((r) => r.commit === head).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
      if (!last) return { holds: false, blocking: [], owed: [], reasons: [`no record of ${head?.slice(0, 12) ?? "HEAD"} — naima metrics run --record`] }
      const reasons = ms.flatMap((m) => {
        const v = last.values[m.name]
        if (v?.holds === true) return []
        if (!v) return [`${m.name}: not in the record of ${head?.slice(0, 12)}`]
        if (v.value === null) return [`${m.name}: no number`]
        return [`${m.name}: ${fmt(v.value, m.unit)}, ${judge(m, v.value).why}`]
      })
      return { holds: reasons.length === 0, blocking: [], owed: [], reasons }
    },
  }
  return {
    name: "metrics",
    contract: CONTRACT,
    says:
      "named measurements — a command's number, or a code-quality number taken in process — recorded per commit, held to a budget, a floor or a baseline, and read back along the commit timeline",
    about:
      "A metric is a name and the command that measures it — test time, coverage, lint warnings, size, how long an analysis runs — or a code measure Naima takes itself from the files: " +
      "lines of code, files, functions, function size, cyclomatic complexity, duplication, TODO markers, dependencies. " +
      "The project declares its metrics as data in its configuration, from scratch or from a preset (`naima metrics presets`). `naima metrics run` runs them and prints every number with the one it is compared to: " +
      "the last recorded on an earlier commit of this line of history, and the bound. A bound is a budget (`atMost`), a floor (`atLeast`) or a baseline (`equals`); " +
      "a `ratchet` makes a gain fail until the bound follows it, so a budget only goes down and a floor only up; loosening a bound names the item that says why. " +
      "`--record` writes the numbers, with the commit they measure, as evidence, one file per run; `naima metrics backfill` measures past commits — code measures from git's objects, commands in a temporary worktree — so the timeline starts full. " +
      "`naima metrics trend`, `history` (text, JSON, CSV) and `plot` (an SVG chart or an HTML report, no dependency) read the records back along the commit timeline, and `naima summary`, `naima board` and `naima queue` show where each metric stands. " +
      "How a number is read is a kind (`metric-kinds`), a code measure (`code-measures`) or a language's function finder (`code-languages`): any plugin may contribute one. Naima may start the programs the metrics name, and only those: the launcher grants each one.",
    options: [
      {
        name: "metrics",
        says:
          `\`plugins.metrics.options.metrics\` in \`${DEFAULT_DATA}/${DATA_FILE}\`: metric name → { "preset", "run": [program, ...args], "prepare", "kind", "pattern", "field", or "measure" with "language", "include", "exclude", "statistic", "window"; "unit", "says", "better", one of "atMost" | "atLeast" | "equals", "ratchet", "tolerance", "because" }. kind defaults to exit, which with no bound must equal 0. A preset fills in the rest; any key beside it overrides it.`,
        default: "{}",
      },
    ],
    dirs: [DIR],
    points: [kindsPoint, metricsPoint, measuresPoint, languagesPoint],
    // The gate exists only where the project declares metrics: a project without any has no gate to hold.
    contributes: {
      "metric-kinds": builtinKinds,
      "code-measures": builtinMeasures,
      "code-languages": builtinLanguages,
      metrics: defs,
      gates: defs.length ? [gate] : [],
      "ui-views": [metricsView],
    },
    // The gate is for the gates plugin, the view for the ui plugin, when each is loaded: without them the metrics still run.
    optional: ["gates", "ui-views"],
    checks: [boundReasons],
    commands: [metricsCommand],
    summary: [summarySection],
  }
}
