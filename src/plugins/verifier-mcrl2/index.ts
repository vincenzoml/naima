// The mCRL2 adapter: a property item whose verifier is `mcrl2` is decided by
// the mCRL2 toolset. The model is an mCRL2 specification; the property is a
// modal mu-calculus formula, written inline or as the path of an .mcf file
// from the project root. The pipeline is the toolset's own:
//
//   mcrl22lps model.mcrl2 model.lps                      linearise
//   lps2pbes --counter-example --formula=f.mcf …         formula and model to a PBES
//   pbessolve --file=model.lps --evidence-file=ev.lps …  true, or false with evidence
//   lps2lts ev.lps ev.aut                                the evidence as a labelled transition system
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
import { dirname, isAbsolute, join, resolve } from "node:path"
import { type Context, CONTRACT, installedProgram, message, type Plugin } from "../../core/api.ts"
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

const TOOLS = ["mcrl22lps", "lps2pbes", "pbessolve", "lps2lts"] as const
type Tool = (typeof TOOLS)[number]

const INSTALL =
  "naima tools install mcrl2 installs mCRL2 202607.0 into Naima's own tools directory; or set plugins.verifier-mcrl2.options.bin to the directory of an mCRL2 installed otherwise"

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

const shown = (r: ToolRun): string => [r.stdout.trim(), r.stderr.trim()].filter(Boolean).join("\n")

/**
 * Where a tool is: in `bin` when it is given; otherwise the mCRL2 `naima tools install mcrl2` installed on this
 * machine; otherwise its name, looked up on PATH.
 */
export function toolPath(tool: string, bin?: string): string {
  return bin ? join(bin, tool) : installedProgram(MCRL2, tool) ?? tool
}

/** The adapter, its tools from `bin` (a directory), the installed mCRL2 or PATH, started by `run`. */
export function mcrl2Verifier(config: { bin?: string; run?: Runner } = {}): Verifier {
  const run = config.run ?? realRun
  const path = (tool: Tool): string => toolPath(tool, config.bin)
  const missing = (tool: Tool): string => `tool missing: ${tool} is not ${config.bin ? `in ${config.bin}` : "installed by naima tools, nor on PATH"} — ${INSTALL}`

  function check({ model, property, options }: VerifyRequest, ctx: Context): VerifyResult {
    const seconds = timeoutOf(options)
    const log: string[] = []
    const dir = mkdtempSync(join(workBase(ctx.program), "run-"))
    try {
      let formula = formulaFile(property, ctx.root)
      if (formula && !existsSync(formula)) return { verdict: "error", output: `the formula file ${property.trim()} does not exist` }
      if (!formula) writeFileSync(formula = join(dir, "property.mcf"), property.trim() + "\n")
      const lps = join(dir, "model.lps")
      const pbes = join(dir, "model.pbes")
      const evidence = join(dir, "evidence.lps")

      /** One step: its output kept in the log; a failure is the result to return. */
      const step = (tool: Tool, args: string[]): { out: ToolRun } | { stop: VerifyResult } => {
        const r = run(path(tool), args, dir, seconds ? seconds * 1000 : undefined)
        if (r.missing) return { stop: { verdict: "error", output: [missing(tool), ...log].join("\n") } }
        log.push(`$ ${tool} ${args.join(" ")}`, ...(shown(r) ? [shown(r)] : []))
        if (r.timedOut) return { stop: { verdict: "unknown", output: [...log, `${tool} did not finish in ${seconds} s`].join("\n") } }
        if (r.error) return { stop: { verdict: "error", output: [...log, `${tool} could not start: ${r.error}`].join("\n") } }
        if (r.exit !== 0) return { stop: { verdict: "error", output: [...log, `${tool} exited ${r.exit}`].join("\n") } }
        return { out: r }
      }

      for (const [tool, args] of [["mcrl22lps", [model, lps]], ["lps2pbes", ["--counter-example", `--formula=${formula}`, lps, pbes]]] as const) {
        const s = step(tool, [...args])
        if ("stop" in s) return s.stop
      }
      const solved = step("pbessolve", [`--file=${lps}`, `--evidence-file=${evidence}`, pbes])
      if ("stop" in solved) return solved.stop
      const answer = solved.out.stdout.trim().split(/\s+/).pop()
      const output = log.join("\n")
      if (answer === "true") return { verdict: "holds", output }
      if (answer !== "false") return { verdict: "unknown", output: `${output}\npbessolve answered neither true nor false` }
      const aut = join(dir, "evidence.aut")
      const printed = step("lps2lts", [evidence, aut])
      const counterexample = "out" in printed && existsSync(aut)
        ? readFileSync(aut, "utf8")
        : `pbessolve answered false; its evidence could not be printed:\n${"stop" in printed ? printed.stop.output : ""}`
      return { verdict: "violated", output: log.join("\n"), counterexample }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  return {
    id: "mcrl2",
    says:
      "an mCRL2 specification against a modal mu-calculus formula, inline or an .mcf file: mcrl22lps, lps2pbes, pbessolve; the evidence is the counterexample",
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
      "`naima verify` runs `mcrl22lps`, `lps2pbes --counter-example`, and `pbessolve` with an evidence file: `true` holds; `false` is violated, and the evidence, printed by `lps2lts` as an `.aut` labelled transition system, is the counterexample; any other answer, or `verifierOptions.timeoutSeconds` reached by a step, is unknown. " +
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
