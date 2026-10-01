// The VoxLogicA adapter: a property item whose verifier is `voxlogica` is
// decided by VoxLogicA, the spatial model checker for images. The model is a
// VoxLogicA session (an .imgql file) that loads its images and prints its
// results; the property is the name of a boolean the session prints:
//
//   load img = "scan.png"
//   let lesion = between(128, 255, intensity(img))
//   print "lesion_found" volume(lesion) .>. 0
//
// `VoxLogicA --json session.imgql` runs it from the session's directory;
// the named value `true` holds, `false` is violated and every value the
// session printed is the counterexample. A tool that is not there, a session
// it rejects, or a name it does not print as a bool, is an error.
//
// The verifier point belongs to the verifier plugin, and plugins never import
// each other: the shapes it takes are declared here.

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path"
import { type Context, CONTRACT, message, type Plugin } from "../../core/api.ts"

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

const LOAD = /^\s*load\s+[A-Za-z_][\w']*\s*=\s*"([^"]+)"/
const IMPORT = /^\s*import\s+"([^"]+)"/

/**
 * The session and every file it reads that is there to read: the images it
 * loads and the sessions it imports, depth first, each path taken from the
 * session's directory as VoxLogicA takes it. An import not beside the session
 * is the tool's own library, part of its version, not an input.
 */
function sessionFiles(model: string): string[] {
  const base = dirname(model)
  const out: string[] = []
  const read = (file: string): void => {
    if (out.includes(file)) return
    out.push(file)
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.replace(/\/\/.*$/, "")
      const loaded = LOAD.exec(line)?.[1]
      const imported = IMPORT.exec(line)?.[1]
      const path = loaded ?? imported
      if (path === undefined) continue
      const abs = resolve(base, path)
      if (!existsSync(abs)) continue
      if (imported !== undefined) read(abs)
      else if (!out.includes(abs)) out.push(abs)
    }
  }
  read(model)
  return out
}

interface Printed {
  name: string
  vltype: string
  value: string
}

const valueOf = (p: Printed): string => (p.vltype === "bool" ? p.value.toLowerCase() : p.value)
const listed = (ps: Printed[]): string => ps.map((p) => `${p.name}=${valueOf(p)}`).join("\n")

const timeoutOf = (options: Record<string, unknown>): number | undefined => {
  const t = options["timeoutSeconds"]
  return typeof t === "number" && t > 0 ? t : undefined
}

/** Where `program` is: itself when it is a path, else the first PATH directory holding it. Null when it cannot be found or looked for. */
function located(program: string): string | null {
  try {
    if (isAbsolute(program)) return existsSync(program) ? program : null
    for (const dir of (process.env["PATH"] ?? "").split(delimiter)) if (dir && existsSync(join(dir, program))) return join(dir, program)
  } catch {
    // no permission to look: the version is then unknown
  }
  return null
}

/** The adapter, VoxLogicA started as `program` (a name on PATH or an absolute path) by `run`; `version` says which release it is when it cannot be read. */
export function voxlogicaVerifier(config: { program?: string; version?: string; run?: Runner } = {}): Verifier {
  const run = config.run ?? realRun
  const program = config.program ?? "VoxLogicA"
  const missing = `tool missing: ${program} is not ${
    isAbsolute(program) ? "there" : "on PATH"
  } — install VoxLogicA (https://github.com/vincenzoml/VoxLogicA/releases) and set plugins.verifier-voxlogica.options.program to its executable`

  function check({ model, property, options }: VerifyRequest): VerifyResult {
    const seconds = timeoutOf(options)
    const name = property.trim()
    const r = run(program, ["--json", basename(model)], dirname(model), seconds ? seconds * 1000 : undefined)
    if (r.missing) return { verdict: "error", output: missing }
    if (r.timedOut) return { verdict: "unknown", output: `VoxLogicA did not finish in ${seconds} s` }
    if (r.error) return { verdict: "error", output: `VoxLogicA could not start: ${r.error}` }
    let parsed: { print?: Printed[]; log?: string; error?: string }
    try {
      parsed = JSON.parse(r.stdout)
    } catch {
      return {
        verdict: "error",
        output: `VoxLogicA exited ${r.exit}, and its output is not the JSON VoxLogicA --json prints:\n${[r.stdout, r.stderr].join("\n").trim()}`,
      }
    }
    const log = (parsed.log ?? "").trim()
    if (r.exit !== 0 || parsed.error) {
      return {
        verdict: "error",
        output: [`VoxLogicA exited ${r.exit}`, (parsed.error ?? "").split("\n").slice(0, 2).join("\n"), log].filter(Boolean).join("\n"),
      }
    }
    const printed = Array.isArray(parsed.print) ? parsed.print : []
    const hit = printed.find((p) => p.name === name)
    if (!hit) {
      return {
        verdict: "error",
        output: `the session prints no value named ${JSON.stringify(name)}; it prints: ${printed.map((p) => p.name).join(", ") || "nothing"}\n${log}`,
      }
    }
    if (hit.vltype !== "bool") return { verdict: "error", output: `${JSON.stringify(name)} is a ${hit.vltype}, not a bool: ${hit.name}=${hit.value}\n${log}` }
    const output = `${name}=${valueOf(hit)}\n${log}`
    return valueOf(hit) === "true" ? { verdict: "holds", output } : { verdict: "violated", output, counterexample: listed(printed) }
  }

  return {
    id: "voxlogica",
    says:
      "a VoxLogicA session (.imgql) over its images; the property is the name of a boolean it prints, true holds; the printed values are the counterexample",
    runs: [program],
    verify: (request) => Promise.resolve(check(request)),
    inputs: ({ model }) => sessionFiles(model),
    version: () => {
      const r = run(program, ["--help"], dirname(located(program) ?? "."))
      if (r.missing) return Promise.reject(new Error(missing))
      if (config.version) return Promise.resolve(`VoxLogicA ${config.version}`)
      const at = located(program)
      try {
        const deps = at && readFileSync(join(dirname(at), "VoxLogicA.deps.json"), "utf8")
        const v = deps && /"VoxLogicA\/([0-9][^"]*)"/.exec(deps)?.[1]
        if (v) return Promise.resolve(`VoxLogicA ${v}`)
      } catch {
        // not readable, or not there: unknown
      }
      return Promise.resolve("VoxLogicA, version unknown")
    },
  }
}

/** The plugin, VoxLogicA started by `run`: tests replay recorded output through it. */
export function voxlogicaPlugin(options: Record<string, unknown> = {}, run: Runner = realRun): Plugin {
  const { program, version } = options
  if (program !== undefined && typeof program !== "string") throw new Error("verifier-voxlogica: program must be a string, a name on PATH or an absolute path")
  if (version !== undefined && typeof version !== "string") throw new Error("verifier-voxlogica: version must be a string")
  return {
    name: "verifier-voxlogica",
    contract: CONTRACT,
    says: "the VoxLogicA adapter: a property is a boolean a spatial model-checking session prints over its images",
    about:
      "Off until `naima.json` names it under `plugins`, since it starts a program. Contributes the `voxlogica` verifier, for VoxLogicA 1.x. `model` is a VoxLogicA session (`.imgql`); `property` is the name of a value it `print`s, which must be a bool. " +
      "`naima verify` runs `VoxLogicA --json <session>` from the session's directory: `true` holds; `false` is violated, and every value the session printed is the counterexample; a session VoxLogicA rejects, a name it does not print, or a value that is not a bool, is an error; `verifierOptions.timeoutSeconds` reached is unknown. " +
      "The run's inputs are the session, the images it `load`s and the sessions it `import`s from its directory. A tool that is not there is an error run whose output begins `tool missing:`. " +
      "The version recorded is the `version` option, else the release named in `VoxLogicA.deps.json` beside the program, else `VoxLogicA, version unknown` — the launcher lets Naima read only the project, so set `version` where the release must be kept with the run.",
    options: [
      { name: "program", says: "the VoxLogicA executable: a name on PATH or an absolute path", default: "VoxLogicA" },
      {
        name: "version",
        says: "the VoxLogicA release, recorded with each run, when it cannot be read beside the program",
        default: "read from VoxLogicA.deps.json",
      },
    ],
    contributes: {
      verifiers: [voxlogicaVerifier({ ...(typeof program === "string" ? { program } : {}), ...(typeof version === "string" ? { version } : {}), run })],
    },
    optional: ["verifiers"],
  }
}

export default function verifierVoxlogica(options: Record<string, unknown> = {}): Plugin {
  return voxlogicaPlugin(options)
}
