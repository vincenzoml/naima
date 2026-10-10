// The mCRL2 adapter: a property item whose verifier is `mcrl2` is decided by
// the mCRL2 toolset. The model is an mCRL2 specification; the property is a
// modal mu-calculus formula, written inline or as the path of an .mcf file
// from the project root. A property chooses its route in `verifierOptions.route`
// (specs/verifier-mcrl2-lts-route-cross-check).
//
// The standard route, `lps`, the default, is the toolset's own:
//
//   mcrl22lps model.mcrl2 model.lps                      linearise
//   lps2pbes --counter-example --formula=f.mcf …         formula and model to a PBES
//   pbessolve --file=model.lps --evidence-file=ev.lps …  true, or false with evidence
//   lps2lts ev.lps ev.aut                                the evidence as a labelled transition system
//
// The LTS route, `lts`, for a formula in the fragment divergence-preserving
// branching bisimilarity preserves (formula.ts):
//
//   mcrl22lps, lps2lts, ltsinfo -a                       the LTS, once per model version (lts-cache.ts)
//   ltsconvert --tau=<unmentioned> -edpbranching-bisim   hide and reduce, per formula
//   lts2pbes, pbessolve                                  the verdict on the reduced LTS
//   lts2pbes -c, pbessolve --evidence-file, ltsconvert   on false: confirmed, and the counterexample, on the full LTS
//
// `cross-check` runs both and gives a verdict only when they agree.
//
// `pbessolve` printing `true` holds, `false` is violated and the evidence is
// the counterexample; anything else, or a time limit hit, is unknown. A tool
// that is not there, or that fails, is an error that says which.
//
// The verifier point belongs to the verifier plugin, and plugins never import
// each other: the shapes it takes are declared here.

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { type Context, CONTRACT, installedProgram, message, type Plugin } from "../../core/api.ts"
import { checkFragment, labelActions } from "./formula.ts"
import { cacheKey, cacheRoot, discard, ENTRY_LPS, ENTRY_LTS, freshFolder, type LtsRecord, prune, publish, readEntry, sha256File } from "./lts-cache.ts"
import { MCRL2 } from "./tool.ts"

export { MCRL2 } from "./tool.ts"

/** What a run of one program gave: its exit status and output, and whether it was not there or ran out of time. */
export interface ToolRun {
  exit: number
  stdout: string
  stderr: string
  missing?: boolean
  timedOut?: boolean
  error?: string
}

/** Runs one program: the real one starts it; a test replays recorded output. */
export type Runner = (program: string, args: string[], cwd: string, timeoutMs?: number) => ToolRun

interface VerifyRequest {
  model: string
  property: string
  options: Record<string, unknown>
}
interface VerifyResult {
  verdict: "holds" | "violated" | "error" | "unknown"
  output: string
  counterexample?: string
  details?: Record<string, unknown>
}
interface Verifier {
  id: string
  says: string
  runs: string[]
  verify(request: VerifyRequest, ctx: Context): Promise<VerifyResult>
  inputs(request: VerifyRequest, ctx: Context): string[]
  version(ctx: Context): Promise<string>
}

/** The program, started for real: colour off, no shell. */
export const realRun: Runner = (program, args, cwd, timeoutMs) => {
  try {
    const r = spawnSync(program, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: "1" },
      ...(timeoutMs ? { timeout: timeoutMs } : {}),
    })
    const code = (r.error as { code?: string } | undefined)?.code
    if (code === "ENOENT") return { exit: -1, stdout: "", stderr: "", missing: true }
    if (code === "ETIMEDOUT" || (timeoutMs && r.signal === "SIGTERM")) return { exit: -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "", timedOut: true }
    if (r.error) return { exit: -1, stdout: "", stderr: "", error: message(r.error) }
    return { exit: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" }
  } catch (e) {
    // Deno refuses a program the launcher did not grant by throwing, not by an error on the result.
    return { exit: -1, stdout: "", stderr: "", error: message(e) }
  }
}

const TOOLS = ["mcrl22lps", "lps2pbes", "pbessolve", "lps2lts", "ltsinfo", "ltsconvert", "lts2pbes"] as const
type Tool = (typeof TOOLS)[number]

const INSTALL =
  "naima tools install mcrl2 installs mCRL2 202607.0 into Naima's own tools directory; or set plugins.verifier-mcrl2.options.bin to the directory of an mCRL2 installed otherwise"

/** The routes a property may take (§1). */
export const ROUTES = ["lps", "lts", "cross-check"] as const
export type Route = (typeof ROUTES)[number]

/** The equivalence the LTS route reduces modulo (§2, step 4). */
export const EQUIVALENCE = "dpbranching-bisim"

/** The arguments of the steps that make an LTS, beyond its files: part of the cache key. `--threads` changes no LTS, so it is not here. */
const RECIPE: LtsRecord["recipe"] = { mcrl22lps: [], lps2lts: [] }

/** The folder beside the program a run keeps its intermediate files in: inside the launcher's fence, and ignored by git through its own .gitignore. */
export const WORK_DIR = ".naima-work"

/**
 * Where a run keeps its intermediate files: in the tracker folder, beside the
 * program, which the launcher lets the program write and read (the system's
 * temporary directory is outside its fence); that directory only when no
 * program is named.
 */
export function workBase(program?: string): string {
  if (!program) return tmpdir()
  const work = join(dirname(program), WORK_DIR)
  const dir = join(work, "verifier-mcrl2")
  mkdirSync(dir, { recursive: true })
  if (!existsSync(join(work, ".gitignore"))) writeFileSync(join(work, ".gitignore"), "*\n")
  return dir
}

/** A property naming an .mcf file: its absolute path, from the project root. */
const formulaFile = (property: string, root: string): string | null => (/\.mcf$/.test(property.trim()) ? resolve(root, property.trim()) : null)

/** The time limit of each step, from the item's `verifierOptions.timeoutSeconds`: none when absent. */
const timeoutOf = (options: Record<string, unknown>): number | undefined => {
  const t = options["timeoutSeconds"]
  return typeof t === "number" && t > 0 ? t : undefined
}

/** The route of a property (§1), or why its `route` option is not one. */
function routeOf(options: Record<string, unknown>): { route: Route } | { wrong: string } {
  const r = options["route"] ?? "lps"
  return (ROUTES as readonly unknown[]).includes(r)
    ? { route: r as Route }
    : { wrong: `verifierOptions.route must be ${ROUTES.map((x) => JSON.stringify(x)).join(", ")}, not ${JSON.stringify(r)}` }
}

/** The `--threads` of lps2lts (§1), or why the `threads` option is not a positive integer. */
function threadsOf(options: Record<string, unknown>): number | string {
  const t = options["threads"] ?? 1
  return typeof t === "number" && Number.isInteger(t) && t > 0 ? t : `verifierOptions.threads must be a positive integer, not ${JSON.stringify(t)}`
}

const shown = (r: ToolRun): string => [r.stdout.trim(), r.stderr.trim()].filter(Boolean).join("\n")

/** The last word `pbessolve` printed: its answer. */
const answerOf = (r: ToolRun): string | undefined => r.stdout.trim().split(/\s+/).pop()

/** What `ltsinfo` prints of an LTS: its size and, with `--action-label`, its labels; one fact per line. */
export function readLtsInfo(text: string): { states: number; transitions: number; labels: string[] } | null {
  const lines = text.split(/\r?\n/)
  const count = (what: string): number | undefined => {
    const line = lines.find((l) => l.startsWith(`Number of ${what}: `))
    const n = line ? Number(line.slice(`Number of ${what}: `.length).replace(/\.$/, "")) : NaN
    return Number.isInteger(n) ? n : undefined
  }
  const states = count("states")
  const transitions = count("transitions")
  if (states === undefined || transitions === undefined) return null
  const from = lines.findIndex((l) => l.startsWith("The action labels of this transition system:"))
  const labels = from < 0 ? [] : lines.slice(from + 1).map((l) => l.trim()).filter(Boolean)
  return { states, transitions, labels }
}

/**
 * Where a tool is: in `bin` when it is given; otherwise the mCRL2 `naima tools install mcrl2` installed on this
 * machine; otherwise its name, looked up on PATH.
 */
export function toolPath(tool: string, bin?: string): string {
  return bin ? join(bin, tool) : installedProgram(MCRL2, tool) ?? tool
}

/** A route's answer: a result with the details of how it was reached. */
type Outcome = VerifyResult & { details: Record<string, unknown> }

/** The adapter, its tools from `bin` (a directory), the installed mCRL2 or PATH, started by `run`. */
export function mcrl2Verifier(config: { bin?: string; run?: Runner } = {}): Verifier {
  const run = config.run ?? realRun
  const path = (tool: Tool): string => toolPath(tool, config.bin)
  const missing = (tool: Tool): string =>
    `tool missing: ${tool} is not ${config.bin ? `in ${config.bin}` : "installed by naima tools, nor on PATH"} — ${INSTALL}`

  /** The steps of one route: each tool's output kept in the log, the tools it started remembered for their versions. */
  function steps(seconds: number | undefined, cwd: string) {
    const log: string[] = []
    const used = new Set<Tool>()
    /** One step: its output kept in the log; a failure is the result to return. */
    const step = (tool: Tool, args: string[], at = cwd): { out: ToolRun } | { stop: VerifyResult } => {
      const r = run(path(tool), args, at, seconds ? seconds * 1000 : undefined)
      if (r.missing) return { stop: { verdict: "error", output: [missing(tool), ...log].join("\n") } }
      used.add(tool)
      log.push(`$ ${tool} ${args.join(" ")}`, ...(shown(r) ? [shown(r)] : []))
      if (r.timedOut) return { stop: { verdict: "unknown", output: [...log, `${tool} did not finish in ${seconds} s`].join("\n") } }
      if (r.error) return { stop: { verdict: "error", output: [...log, `${tool} could not start: ${r.error}`].join("\n") } }
      if (r.exit !== 0) return { stop: { verdict: "error", output: [...log, `${tool} exited ${r.exit}`].join("\n") } }
      return { out: r }
    }
    /** Each tool this route started, with the first line of its `--version` (§5). */
    const tools = (): Record<string, string> =>
      Object.fromEntries(
        [...used].sort().map((t) => {
          const r = run(path(t), ["--version"], cwd)
          return [t, r.exit === 0 ? r.stdout.trim().split("\n")[0]!.trim() : `unknown: --version exited ${r.exit}`]
        }),
      )
    return { log, step, tools }
  }

  /** The standard route: the formula against the linearised model. */
  function lpsRoute(model: string, formula: string, dir: string, seconds: number | undefined): Outcome {
    const s = steps(seconds, dir)
    const done = (r: VerifyResult): Outcome => ({ ...r, details: { route: "lps", tools: s.tools() } })
    const lps = join(dir, "model.lps")
    const pbes = join(dir, "model.pbes")
    const evidence = join(dir, "evidence.lps")
    for (const [tool, args] of [["mcrl22lps", [model, lps]], ["lps2pbes", ["--counter-example", `--formula=${formula}`, lps, pbes]]] as const) {
      const r = s.step(tool, [...args])
      if ("stop" in r) return done(r.stop)
    }
    const solved = s.step("pbessolve", [`--file=${lps}`, `--evidence-file=${evidence}`, pbes])
    if ("stop" in solved) return done(solved.stop)
    const answer = answerOf(solved.out)
    const output = s.log.join("\n")
    if (answer === "true") return done({ verdict: "holds", output })
    if (answer !== "false") return done({ verdict: "unknown", output: `${output}\npbessolve answered neither true nor false` })
    const aut = join(dir, "evidence.aut")
    const printed = s.step("lps2lts", [evidence, aut])
    const counterexample = "out" in printed && existsSync(aut)
      ? readFileSync(aut, "utf8")
      : `pbessolve answered false; its evidence could not be printed:\n${"stop" in printed ? printed.stop.output : ""}`
    return done({ verdict: "violated", output: s.log.join("\n"), counterexample })
  }

  /** The LTS of the model, from the cache or generated into it (§4). */
  function ltsOf(
    model: string,
    ctx: Context,
    s: ReturnType<typeof steps>,
    threads: number,
  ): { stop: VerifyResult } | { dir: string; record: LtsRecord; reused: boolean } {
    const version = run(path("mcrl22lps"), ["--version"], workBase(ctx.program))
    if (version.missing) return { stop: { verdict: "error", output: missing("mcrl22lps") } }
    if (version.exit !== 0) return { stop: { verdict: "error", output: `mcrl22lps --version exited ${version.exit}: ${shown(version)}` } }
    const toolVersion = version.stdout.trim().split("\n")[0]!.trim()
    const rel = relative(ctx.root, model).split(sep).join("/")
    const inputs = [{ path: rel, sha256: sha256File(model) }]
    const key = cacheKey(inputs, toolVersion, RECIPE)
    const root = cacheRoot(workBase(ctx.program))
    const found = readEntry(root, key)
    if (found) {
      s.log.push(`LTS reused from the cache: ${key} (${found.record.states} states, ${found.record.transitions} transitions)`)
      return { ...found, reused: true }
    }
    if (existsSync(join(root, key))) discard(join(root, key))
    const folder = freshFolder(root)
    try {
      const lps = join(folder, ENTRY_LPS)
      const lts = join(folder, ENTRY_LTS)
      const started = Date.now()
      const threaded = threads > 1 ? [`--threads=${threads}`] : []
      for (const [tool, args] of [["mcrl22lps", [model, lps]], ["lps2lts", [...threaded, lps, lts]]] as const) {
        const r = s.step(tool, [...args], folder)
        if ("stop" in r) return r
      }
      const generationSeconds = Math.round((Date.now() - started) / 100) / 10
      const info = s.step("ltsinfo", ["--action-label", lts], folder)
      if ("stop" in info) return info
      const read = readLtsInfo(`${info.out.stdout}\n${info.out.stderr}`)
      if (!read) return { stop: { verdict: "error", output: [...s.log, "ltsinfo printed no number of states and transitions"].join("\n") } }
      const record: LtsRecord = {
        key,
        model: rel,
        inputs,
        toolVersion,
        recipe: RECIPE,
        ltsSha256: sha256File(lts),
        ...read,
        generationSeconds,
        at: new Date().toISOString(),
      }
      const entry = publish(root, folder, record)
      prune(root, key, rel)
      return { ...entry, reused: false }
    } finally {
      if (existsSync(folder)) discard(folder)
    }
  }

  /** The LTS route (§2): refused outside the fragment (§3), on the cached LTS, hidden and reduced per formula. */
  function ltsRoute(model: string, formula: string, dir: string, ctx: Context, seconds: number | undefined, threads: number): Outcome {
    const s = steps(seconds, dir)
    const details: Record<string, unknown> = { route: "lts" }
    const done = (r: VerifyResult): Outcome => ({ ...r, details: { ...details, tools: s.tools() } })
    const refuse = (why: string): Outcome =>
      done({
        verdict: "error",
        output: [`LTS route refused: ${why}.`, `Route "lps" decides this property by the standard route.`, ...s.log].join("\n"),
      })

    const fragment = checkFragment(readFileSync(formula, "utf8"))
    if (!fragment.ok) return refuse(`${fragment.reason} (specs/verifier-mcrl2-lts-route-cross-check, §3.1)`)
    details["mentioned"] = fragment.mentioned

    const lts = ltsOf(model, ctx, s, threads)
    if ("stop" in lts) return done(lts.stop)
    const { record } = lts
    details["lts"] = {
      key: record.key,
      reused: lts.reused,
      states: record.states,
      transitions: record.transitions,
      generationSeconds: record.generationSeconds,
    }

    const mentioned = new Set(fragment.mentioned)
    const hidden = new Set<string>()
    for (const label of record.labels) {
      const names = labelActions(label)
      if (!names) return refuse(`the LTS label ${JSON.stringify(label)} cannot be read as a multi-action (§3.3)`)
      if (names.length > 1 && names.some((n) => !mentioned.has(n))) {
        return refuse(`the LTS label ${JSON.stringify(label)} joins a hidden action to another: hiding would change what the formula sees (§3.3)`)
      }
      for (const n of names) if (!mentioned.has(n)) hidden.add(n)
    }
    const hiddenNames = [...hidden].sort()
    details["hidden"] = hiddenNames

    const full = join(lts.dir, ENTRY_LTS)
    const reduced = join(dir, "reduced.lts")
    const tau = hiddenNames.length ? [`--tau=${hiddenNames.join(",")}`] : []
    const converted = s.step("ltsconvert", [...tau, `--equivalence=${EQUIVALENCE}`, full, reduced])
    if ("stop" in converted) return done(converted.stop)
    const info = s.step("ltsinfo", [reduced])
    if ("stop" in info) return done(info.stop)
    const size = readLtsInfo(`${info.out.stdout}\n${info.out.stderr}`)
    if (!size) return done({ verdict: "error", output: [...s.log, "ltsinfo printed no number of states and transitions"].join("\n") })
    details["reduced"] = { equivalence: EQUIVALENCE, states: size.states, transitions: size.transitions }

    const pbes = join(dir, "reduced.pbes")
    const translated = s.step("lts2pbes", [`--formula=${formula}`, reduced, pbes])
    if ("stop" in translated) return done(translated.stop)
    const solved = s.step("pbessolve", [pbes])
    if ("stop" in solved) return done(solved.stop)
    const answer = answerOf(solved.out)
    if (answer === "true") return done({ verdict: "holds", output: s.log.join("\n") })
    if (answer !== "false") return done({ verdict: "unknown", output: `${s.log.join("\n")}\npbessolve answered neither true nor false` })

    // False: confirmed on the full LTS, whose evidence is the counterexample over the model's own actions (§2, step 6).
    details["counterexampleFrom"] = "unreduced LTS"
    const fullPbes = join(dir, "full.pbes")
    const evidence = join(dir, "evidence.lts")
    const again = s.step("lts2pbes", ["--counter-example", `--formula=${formula}`, full, fullPbes])
    if ("stop" in again) return done(again.stop)
    const confirmed = s.step("pbessolve", [`--file=${full}`, `--evidence-file=${evidence}`, fullPbes])
    if ("stop" in confirmed) return done(confirmed.stop)
    const second = answerOf(confirmed.out)
    if (second !== "false") {
      return done({
        verdict: "error",
        output: `${s.log.join("\n")}\nthe reduced and the unreduced LTS disagree: false on the reduced one, ${second || "no answer"} on the unreduced one`,
      })
    }
    const aut = join(dir, "evidence.aut")
    const printed = s.step("ltsconvert", [evidence, aut])
    const counterexample = "out" in printed && existsSync(aut)
      ? readFileSync(aut, "utf8")
      : `pbessolve answered false; its evidence could not be printed:\n${"stop" in printed ? printed.stop.output : ""}`
    return done({ verdict: "violated", output: s.log.join("\n"), counterexample })
  }

  /** Both routes (§6): a verdict only when they reach the same one. */
  function crossCheck(lps: Outcome, lts: Outcome): Outcome {
    const reached = (o: Outcome) => o.verdict === "holds" || o.verdict === "violated"
    const both = reached(lps) && reached(lts)
    const agree = both ? lps.verdict === lts.verdict : null
    const details = { route: "cross-check", lps: { verdict: lps.verdict, ...lps.details }, lts: { verdict: lts.verdict, ...lts.details }, agree }
    const logs = `== standard route (lps): ${lps.verdict}\n${lps.output}\n== LTS route (lts): ${lts.verdict}\n${lts.output}`
    if (agree) return { verdict: lps.verdict, output: logs, ...(lps.counterexample !== undefined ? { counterexample: lps.counterexample } : {}), details }
    if (both) {
      return { verdict: "error", output: `the routes disagree: the standard route says ${lps.verdict}, the LTS route says ${lts.verdict}\n${logs}`, details }
    }
    return { verdict: lps.verdict === "error" || lts.verdict === "error" ? "error" : "unknown", output: logs, details }
  }

  function check({ model, property, options }: VerifyRequest, ctx: Context): VerifyResult {
    const chosen = routeOf(options)
    if ("wrong" in chosen) return { verdict: "error", output: chosen.wrong }
    const threads = threadsOf(options)
    if (typeof threads === "string") return { verdict: "error", output: threads }
    const seconds = timeoutOf(options)
    const dir = mkdtempSync(join(workBase(ctx.program), "run-"))
    try {
      let formula = formulaFile(property, ctx.root)
      if (formula && !existsSync(formula)) return { verdict: "error", output: `the formula file ${property.trim()} does not exist` }
      if (!formula) writeFileSync(formula = join(dir, "property.mcf"), property.trim() + "\n")
      if (chosen.route === "lps") return lpsRoute(model, formula, dir, seconds)
      if (chosen.route === "lts") return ltsRoute(model, formula, dir, ctx, seconds, threads)
      const sub = (name: string): string => {
        const d = join(dir, name)
        mkdirSync(d)
        return d
      }
      return crossCheck(lpsRoute(model, formula, sub("lps"), seconds), ltsRoute(model, formula, sub("lts"), ctx, seconds, threads))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  return {
    id: "mcrl2",
    says:
      "an mCRL2 specification against a modal mu-calculus formula, inline or an .mcf file: by the standard route (mcrl22lps, lps2pbes, pbessolve), by the LTS route (the state space once per model, hidden and reduced per formula, lts2pbes, pbessolve) for a formula the reduction preserves, or both, cross-checked; the evidence is the counterexample",
    runs: TOOLS.map(path),
    verify: (request, ctx) => Promise.resolve(check(request, ctx)),
    inputs: ({ model, property }, ctx) => {
      const f = formulaFile(property, ctx.root)
      return f ? [model, f] : [model]
    },
    version: (ctx) => {
      const r = run(path("mcrl22lps"), ["--version"], workBase(ctx.program))
      if (r.missing) return Promise.reject(new Error(missing("mcrl22lps")))
      if (r.exit !== 0) return Promise.reject(new Error(`mcrl22lps --version exited ${r.exit}: ${shown(r) || r.error || ""}`))
      return Promise.resolve(r.stdout.trim().split("\n")[0]!.trim())
    },
  }
}

/** The plugin, its tools started by `run`: tests replay recorded output through it. */
export function mcrl2Plugin(options: Record<string, unknown> = {}, run: Runner = realRun): Plugin {
  const bin = options["bin"]
  if (bin !== undefined && (typeof bin !== "string" || !isAbsolute(bin))) {
    throw new Error("verifier-mcrl2: bin must be an absolute path to the directory holding the mCRL2 tools")
  }
  return {
    name: "verifier-mcrl2",
    contract: CONTRACT,
    says: "the mCRL2 adapter: a property is a modal mu-calculus formula over an mCRL2 specification",
    about:
      "Off until `naima.json` names it under `plugins`, since it starts programs. Contributes the `mcrl2` verifier and the `mcrl2` tool. `model` is an mCRL2 specification; `property` is a modal mu-calculus formula, inline, or the path of an `.mcf` file from the project root, which is then an input of the run. " +
      "A property chooses its route in `verifierOptions.route`. `lps`, the default, is the standard route: `mcrl22lps`, `lps2pbes --counter-example`, and `pbessolve` with an evidence file: `true` holds; `false` is violated, and the evidence, printed by `lps2lts` as an `.aut` labelled transition system, is the counterexample; any other answer, or `verifierOptions.timeoutSeconds` reached by a step, is unknown. " +
      "`lts`, the LTS route, is for a model whose state space is small but whose data makes the standard route slow. The formula is first checked to be in the fragment that divergence-preserving branching bisimilarity preserves — every visible step right after a star over an action formula that includes tau, no single step that includes tau, fixpoints only as the four inevitability patterns — and refused otherwise, as an error run whose output begins `LTS route refused:`. Then `mcrl22lps` and `lps2lts` (with `--threads` from `verifierOptions.threads`) make the LTS once per model version, kept in the run work folder under a key over the model's contents, the toolset's version and the recipe, and shared by every property of that model; per formula, `ltsconvert` hides every action the formula does not mention and reduces modulo `dpbranching-bisim`, and `lts2pbes` and `pbessolve` decide; on false, the full LTS is solved again with evidence, for the counterexample, and a disagreement is an error. " +
      "`cross-check` runs both routes and gives a verdict only when they agree; a disagreement is an error whose output begins `the routes disagree:`. Each run records in its `details` the route, the version of every tool it started, and for the LTS route the LTS's key, reuse and size, the mentioned and hidden actions and the reduced size. " +
      "The tools are taken from `bin` when it is given, otherwise from the mCRL2 202607.0 that `naima tools install mcrl2` installed on this machine, otherwise from PATH; the plugin declares that tool, so `naima tools` reports it. A tool that is not there is an error run whose output begins `tool missing:`; a tool that fails is an error with its output. The version recorded is the first line of `mcrl22lps --version`.",
    options: [
      {
        name: "bin",
        says: "the absolute directory holding the mCRL2 tools; absent, the mCRL2 naima tools installed on this machine, then PATH",
        default: "installed, then PATH",
      },
    ],
    contributes: { verifiers: [mcrl2Verifier({ ...(typeof bin === "string" ? { bin } : {}), run })], tools: [MCRL2] },
    optional: ["verifiers", "tools"],
  }
}

export default function verifierMcrl2(options: Record<string, unknown> = {}): Plugin {
  return mcrl2Plugin(options)
}
