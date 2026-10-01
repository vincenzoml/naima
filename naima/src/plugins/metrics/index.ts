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
// line of history, and the bound.

import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
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
  parse,
  type Plugin,
  str,
  table,
  usageError,
  writeJson,
} from "../../core/api.ts"

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
  run: string[]
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
  /** The program the launcher must let it start: the first word of `run`. */
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

/** The point the project's metrics stand on: `naima runs` and the launcher read the programs they start from it. */
export const metricsPoint: ExtensionPoint<MetricDef> = {
  id: "metrics",
  says: "a named measurement: `run` (a program and its arguments), `kind`, and a bound — `atMost`, `atLeast` or `equals`",
  noun: "metric",
  stored: true,
  key: (m) => m.name,
  renamed: (m, name) => ({ ...m, name }),
  validate: (v) => (isObject(v) && typeof v["name"] === "string" && Array.isArray(v["run"]) ? null : "has no name or run"),
  configured: () => true,
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

/** The project's metrics, as its naima.json says them; throws on a malformed one, naming it. */
export function readMetrics(options: Record<string, unknown>): Record<string, MetricConfig> {
  const metrics = options["metrics"] ?? {}
  if (!isObject(metrics)) throw new Error("metrics: options.metrics must be an object")
  for (const [name, raw] of Object.entries(metrics)) {
    const at = `metrics: metric "${name}"`
    if (!NAME.test(name)) throw new Error(`${at}: a name is lowercase letters, digits, dots, dashes and underscores`)
    if (!isObject(raw)) throw new Error(`${at} must be an object`)
    const run = raw["run"]
    if (!Array.isArray(run) || !run.length || !run.every((w) => typeof w === "string" && w.length)) {
      throw new Error(`${at}: run is the command as a list, the program first: ["deno", "task", "test"]`)
    }
    if (!/^[^\s,]+$/.test(run[0] as string)) throw new Error(`${at}: the program, ${JSON.stringify(run[0])}, has a space or a comma`)
    for (const key of ["says", "kind", "pattern", "unit", "because"]) {
      if (raw[key] !== undefined && typeof raw[key] !== "string") throw new Error(`${at}: ${key} is a string`)
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
  }
  return metrics as Record<string, MetricConfig>
}

/** The bound a metric is held to, if any: kind exit with none must equal 0. */
export function boundOf(m: MetricConfig): { bound: Bound; value: number } | null {
  for (const b of BOUNDS) if (num(m[b])) return { bound: b, value: m[b] }
  return (m.kind ?? "exit") === "exit" ? { bound: "equals", value: 0 } : null
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
  at: string
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

/**
 * The line of history up to HEAD, oldest first, and each commit's latest record of `name`: the trend.
 * A record of a commit off this line (another branch's) is not on it.
 */
export function history(ctx: Context, name: string): { commit: string; at: string; value: number; dirty: boolean }[] {
  const line = (git(ctx, "rev-list", "--reverse", "HEAD") ?? "").split("\n").filter(Boolean)
  const latest = new Map<string, MetricRecord>()
  for (const r of readRecords(ctx)) {
    if (!r.values[name] || typeof r.values[name].value !== "number") continue
    const prior = latest.get(r.commit)
    if (!prior || prior.at < r.at) latest.set(r.commit, r)
  }
  return line.flatMap((c) => {
    const r = latest.get(c)
    const v = r?.values[name]?.value
    return r && typeof v === "number" ? [{ commit: c, at: r.at, value: v, dirty: r.dirty }] : []
  })
}

/** The number a new measurement of `name` is compared to: the last one recorded on an earlier commit of this line, or none. */
export function baselineOf(ctx: Context, name: string, head: string | null): number | undefined {
  return history(ctx, name).filter((h) => h.commit !== head).at(-1)?.value
}

const kindOf = (ctx: Context, id: string): MetricKind | undefined => ctx.registry.find<MetricKind>("metric-kinds", id)?.value
const metricsOf = (ctx: Context): MetricDef[] => ctx.registry.contributions("metrics").map((c) => c.value as MetricDef)

/** Run a metric's command in the project root and read its number. */
export function measure(ctx: Context, m: MetricDef): { value: number | null; exit: number; error?: string } {
  const kind = kindOf(ctx, m.kind ?? "exit")
  if (!kind) return { value: null, exit: -1, error: `no metric kind "${m.kind}"` }
  const [program, ...args] = m.run
  const start = performance.now()
  const r = spawnSync(program as string, args, { cwd: ctx.root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
  const run: RunOutput = { exit: r.error ? -1 : r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "", seconds: (performance.now() - start) / 1000 }
  if (run.exit !== 0 && !kind.readsExit) {
    const tail = `${run.stderr}${run.stdout}`.trim().split("\n").slice(-3).join(" | ")
    return {
      value: null,
      exit: run.exit,
      error: r.error ? `${program} could not be started: ${r.error.message}` : `exited ${run.exit}${tail ? `: ${tail}` : ""}`,
    }
  }
  const read = kind.read(run, m)
  return typeof read === "number" ? { value: read, exit: run.exit } : { value: null, exit: run.exit, error: read.error }
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

const metricsCommand: Command = {
  name: "metrics",
  says:
    "the project's metrics — each a name and the command that measures it — run, recorded per commit, held to a budget, a floor or a baseline, and shown as a trend; every number with the one it is compared to",
  usage: "metrics [list] | metrics run [name...] [--record] | metrics bound <name> <value> [--because <item>] | metrics trend <name>",
  options: [
    { name: "--record", says: "run: write the numbers, with the commit they measure, to metrics/ in the data directory" },
    { name: "--because", says: "bound: the item that says why a bound is loosened — a budget raised, a floor lowered; refused without it" },
  ],
  examples: ["metrics", "metrics run --record", "metrics run tests coverage", "metrics bound test-time 140 --because bugs/slow-ci", "metrics trend tests"],
  run(args, ctx) {
    const p = parse(args, { record: { type: "boolean" }, because: { type: "string" } })
    const [sub = "list", ...rest] = p.positionals
    const head = git(ctx, "rev-parse", "HEAD")
    if (sub === "list") {
      if (rest.length) throw usageError(this)
      const ms = metricsOf(ctx)
      if (!ms.length) {
        ctx.out(`no metrics declared — plugins.metrics.options.metrics in ${ctx.trackerDir}/${DATA_FILE}`)
        return 0
      }
      for (const m of ms) {
        const h = history(ctx, m.name)
        const last = h.at(-1)
        ctx.out(
          `${m.name.padEnd(16)} ${m.kind ?? "exit"}, ${boundText(m)}${m.ratchet ? ", ratchet" : ""}; last ${fmt(last?.value, m.unit)}  — ${m.run.join(" ")}`,
        )
      }
      return 0
    }
    if (sub === "run") {
      const wanted = rest.length ? rest.map((n) => find(ctx, n)) : metricsOf(ctx)
      if (!wanted.length) throw new Error(`no metrics declared — plugins.metrics.options.metrics in ${ctx.trackerDir}/${DATA_FILE}`)
      const dirty = (git(ctx, "status", "--porcelain", "--", ".", `:(exclude)${ctx.trackerDir}`) ?? "") !== ""
      const values: MetricRecord["values"] = {}
      let failed = 0
      for (const m of wanted) {
        const r = measure(ctx, m)
        const was = baselineOf(ctx, m.name, head)
        if (r.value === null) {
          failed++
          values[m.name] = { value: null, exit: r.exit, holds: false }
          ctx.out(`  ✗ ${m.name}: no number (was ${fmt(was, m.unit)}) — ${r.error}`)
          continue
        }
        const j = judge(m, r.value)
        if (!j.holds) failed++
        values[m.name] = { value: r.value, exit: r.exit, holds: j.holds }
        const move = j.moveTo !== undefined ? ` — naima metrics bound ${m.name} ${j.moveTo}` : ""
        ctx.out(
          `  ${j.holds ? "✓" : "✗"} ${m.name}: ${fmt(r.value, m.unit)} (was ${fmt(was, m.unit)}${delta(r.value, was)}; ${boundText(m)}) — ${j.why}${move}`,
        )
      }
      ctx.out(
        `${failed ? `${failed} of ${wanted.length} metrics fail` : `all ${wanted.length} metrics hold`} on ${head?.slice(0, 12) ?? "no commit"}${
          dirty ? " and uncommitted changes" : ""
        }`,
      )
      if (bool(p, "record")) {
        if (!head) throw new Error("nothing to record against: the repository has no commit yet")
        const record: MetricRecord = { commit: head, dirty, at: ctx.now().toISOString(), values }
        mkdirSync(recordsDir(ctx), { recursive: true })
        const file = `${head}-${randomUUID().slice(0, 8)}.json`
        writeJson(join(recordsDir(ctx), file), record)
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
        ctx.out(`${m.name}: nothing recorded on this line of history — naima metrics run --record`)
        return 0
      }
      ctx.out(`${m.name} (${boundText(m)}): ${sparkline(h.map((x) => x.value))}  ${fmt(h[0]?.value, m.unit)} → ${fmt(h.at(-1)?.value, m.unit)}`)
      h.forEach((x, i) =>
        ctx.out(
          `  ${x.commit.slice(0, 12)}  ${x.at.slice(0, 10)}  ${fmt(x.value, m.unit)}${delta(x.value, h[i - 1]?.value)}${
            x.dirty ? "  (uncommitted changes)" : ""
          }`,
        )
      )
      return 0
    }
    throw usageError(this)
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
  evaluate(ctx: Context): { holds: boolean; blocking: Item[]; owed: Item[] }
}

export default function metrics(options: Record<string, unknown> = {}): Plugin {
  const declared = readMetrics(options)
  const defs: MetricDef[] = Object.entries(declared).map(([name, c]) => ({ ...c, name, runs: [c.run[0] as string], configured: true }))
  const gate: Gate = {
    name: "metrics",
    configured: true,
    title: "The project's metrics",
    says: "every declared metric held to its bound on the last record of HEAD's commit",
    decides:
      "holds when the latest record of HEAD's commit (naima metrics run --record) has every declared metric within its bound; with no record of HEAD, it holds only if no metric is declared. It blocks on no item: naima metrics run says which number fails.",
    evaluate(ctx) {
      const ms = metricsOf(ctx)
      if (!ms.length) return { holds: true, blocking: [], owed: [] }
      const head = git(ctx, "rev-parse", "HEAD")
      const last = readRecords(ctx).filter((r) => r.commit === head).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
      const holds = !!last && ms.every((m) => last.values[m.name]?.holds === true)
      return { holds, blocking: [], owed: [] }
    },
  }
  return {
    name: "metrics",
    contract: CONTRACT,
    says: "named measurements, each the command that measures it, recorded per commit and held to a budget, a floor or a baseline",
    about: "A metric is a name and the command that measures it — test time, coverage, lint warnings, size, how long an analysis runs. " +
      "The project declares its metrics as data in its configuration; this plugin brings none. `naima metrics run` runs them and prints every number with the one it is compared to: " +
      "the last recorded on an earlier commit of this line of history, and the bound. A bound is a budget (`atMost`), a floor (`atLeast`) or a baseline (`equals`); " +
      "a `ratchet` makes a gain fail until the bound follows it, so a budget only goes down and a floor only up; loosening a bound names the item that says why. " +
      "`--record` writes the numbers, with the commit they measure, as evidence; `naima metrics trend` draws them along history. " +
      "How a number is read is a kind, and any plugin may contribute one to the `metric-kinds` point. Naima may start the programs the metrics name, and only those: the launcher grants each one.",
    options: [
      {
        name: "metrics",
        says:
          `\`plugins.metrics.options.metrics\` in \`${DEFAULT_DATA}/${DATA_FILE}\`: metric name → { "run": [program, ...args], "kind", "pattern", "unit", "says", one of "atMost" | "atLeast" | "equals", "ratchet", "tolerance", "because" }. kind defaults to exit, which with no bound must equal 0.`,
        default: "{}",
      },
    ],
    dirs: [DIR],
    points: [kindsPoint, metricsPoint],
    // The gate exists only where the project declares metrics: a project without any has no gate to hold.
    contributes: { "metric-kinds": builtinKinds, metrics: defs, gates: defs.length ? [gate] : [] },
    // The gate is for the gates plugin, when it is loaded: without it the metrics still run.
    optional: ["gates"],
    checks: [boundReasons],
    commands: [metricsCommand],
  }
}
