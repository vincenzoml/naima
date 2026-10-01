// The launcher: the one piece of Naima that runs with every permission, and
// all it does is work out where things are, then run the program under Deno
// with only these (docs/install.md says why each one exists):
//
//   read    the repository, the program wherever it is, and the data directory of every other worktree
//   write   the tracker folder (naima-tracker/), and the data and program if moved out of it
//   run     git, and the programs the loaded verifiers declare (Verifier.runs), nothing else
//   env     an allow-list of the environment (ENV below): what git needs, and Naima's own
//   net     none: the network is git's, for alignment and update
//
// When the program exits with RELAUNCH it has just aligned the program
// directory, so the code on disk is not the code that ran: the launcher runs
// the program directory's own code, which is the locked commit.

import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DATA_FILE,
  EXCLUDE_FILES,
  findData,
  globalOptions,
  message,
  PROGRAM_DIR,
  programOf,
  real,
  RELAUNCH,
  toplevel,
  TRACKER_DIR,
  trackerOf,
  worktrees,
} from "./core/internal.ts"

/** Alignment, an update and its migration: at most three hand-overs, and one to spare. */
const MAX_RUNS = 4

/**
 * The environment the program is handed; nothing else reaches it, nor the git
 * it runs. Naima reads only NAIMA_*; the rest is what git, ssh and a proxy
 * need to reach a source, and what Deno needs to run. Deno cannot grant a
 * named list and still let node:child_process hand git its environment, so
 * the list is enforced by giving the program only these variables.
 */
export const ENV = {
  names: [
    "HOME",
    "USER",
    "LOGNAME",
    "PATH",
    "SHELL",
    "TERM",
    "LANG",
    "TZ",
    "TMPDIR",
    "TMP",
    "TEMP",
    "NO_COLOR",
    "FORCE_COLOR",
    "DISPLAY",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "XDG_DATA_HOME",
    "XDG_RUNTIME_DIR",
    "GNUPGHOME",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "ALL_PROXY",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "PATHEXT",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "HOMEDRIVE",
    "HOMEPATH",
    "PROGRAMDATA",
  ],
  prefixes: ["NAIMA_", "GIT_", "SSH_", "LC_", "DENO_"],
} as const

/** The variables of `env` the program may see: ENV's names and prefixes, compared as Windows does, without case. */
export function allowedEnv(env: Record<string, string>): Record<string, string> {
  const names = new Set<string>(ENV.names)
  const keep = (name: string): boolean => names.has(name.toUpperCase()) || ENV.prefixes.some((p) => name.toUpperCase().startsWith(p))
  return Object.fromEntries(Object.entries(env).filter(([name]) => keep(name)))
}

/**
 * The permissions the program runs with, as Deno flags. Throws when a path cannot be said in one: Deno splits the lists on commas.
 * `worktrees` are the other worktrees' data directories: read-only, and one with a comma is left out — it is read from its branch.
 */
export function permissions(
  p: {
    root: string
    tracker: string
    data: string | null
    program: string
    entry: string
    hostFiles?: string[]
    worktrees?: string[]
    /** The programs the loaded verifiers start, besides git (Verifier.runs). */
    runs?: string[]
  },
): string[] {
  const list = (paths: (string | null)[]) => {
    const all = [...new Set(paths.filter((x): x is string => x !== null).map(real))]
    const comma = all.find((x) => x.includes(","))
    if (comma) {
      throw new Error(
        `the path ${comma} holds a comma, which Deno's permission flags cannot express (they split on commas) — move the project, or the program, to a path without one`,
      )
    }
    return all.join(",")
  }
  return [
    `--allow-read=${list([p.root, p.data, p.program, p.entry, ...(p.worktrees ?? []).map(real).filter((x) => !x.includes(","))])}`,
    `--allow-write=${list([p.tracker, p.data, p.program, ...(p.hostFiles ?? [])])}`,
    `--allow-run=${["git", ...(p.runs ?? [])].join(",")}`,
    "--allow-env",
  ]
}

/**
 * The data directory of every other worktree of the project, where each one's uncommitted records are: the
 * cross-branch views read them from disk (docs/flows/worktree-isolation.md). Only when the data is inside the project.
 */
function otherWorktrees(root: string, data: string | null): string[] {
  if (!data) return []
  const inside = relative(real(root), real(data))
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) return []
  return worktrees(root).filter((w) => !w.self).map((w) => join(w.path, inside))
}

/**
 * Does the project load code the program does not ship — a third-party
 * plugin, or a replacement for a first-party one? Only such code can declare
 * programs to run: no first-party contribution starts one. Read in every
 * format: a list of plugins (format 1), or a table whose entries name a
 * source or a replacement.
 */
function loadsPlugins(data: string | null): boolean {
  if (!data) return false
  try {
    const plugins = (JSON.parse(readFileSync(join(data, DATA_FILE), "utf8")) as { plugins?: unknown }).plugins
    if (Array.isArray(plugins)) return plugins.length > 0
    if (!plugins || typeof plugins !== "object") return false
    return Object.values(plugins).some((e) => !!e && typeof e === "object" && ("source" in e || "replacedBy" in e))
  } catch {
    return false
  }
}

/**
 * The programs the loaded contributions declare they start, asked of the program
 * that is about to run (`naima runs --json`), under the same read permission
 * and nothing else: no write, no network, and git alone to run. Asked only
 * when the project loads third-party plugins; an answer that is not a list of
 * names is no programs.
 */
function declaredRuns(entry: string, cwd: string, read: string, env: Record<string, string>): string[] {
  const { NAIMA_LAUNCHED: _launched, ...probeEnv } = env
  const r = new Deno.Command(Deno.execPath(), {
    args: ["run", "--no-prompt", "--no-config", "--no-lock", read, "--allow-run=git", "--allow-env", join(entry, "src", "cli.ts"), "runs", "--json"],
    cwd,
    clearEnv: true,
    env: probeEnv,
    stdin: "null",
    stdout: "piped",
    stderr: "null",
  }).outputSync()
  if (!r.success) return []
  try {
    const list: unknown = JSON.parse(new TextDecoder().decode(r.stdout))
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string" && /^[^\s,]+$/.test(x)) : []
  } catch {
    return []
  }
}

/** The host files the run may write outside the tracker folder: only `init --write-excludes` has any. */
function hostFiles(rest: string[], root: string): string[] {
  const [command, ...args] = rest
  return command === "init" && args.includes("--write-excludes") ? EXCLUDE_FILES.map((f) => join(root, f)) : []
}

export async function launch(args: string[], cwd: string): Promise<number> {
  let parsed: ReturnType<typeof globalOptions>
  try {
    parsed = globalOptions(args)
  } catch {
    parsed = { rest: args } // the program says what is wrong with the arguments
  }
  const own = dirname(dirname(fileURLToPath(import.meta.url)))
  const data = findData(cwd, parsed.data ?? Deno.env.get("NAIMA_DATA"))
  const root = toplevel(data ?? cwd) ?? resolve(cwd)
  const tracker = data ? trackerOf(data) : join(root, TRACKER_DIR)
  const program = data && existsSync(join(data, DATA_FILE)) ? programOf(data) : join(tracker, PROGRAM_DIR)
  const env = { ...allowedEnv(Deno.env.toObject()), NAIMA_LAUNCHED: "1", ...(data ? { NAIMA_DATA: data } : {}) }
  const others = otherWorktrees(root, data)
  let entry = existsSync(join(program, "src", "cli.ts")) ? program : own
  for (let run = 0; run < MAX_RUNS; run++) {
    let flags: string[]
    try {
      const fence = { root, tracker, data, program, entry, hostFiles: hostFiles(parsed.rest, root), worktrees: others }
      const read = permissions(fence)[0] ?? ""
      flags = permissions({ ...fence, runs: loadsPlugins(data) ? declaredRuns(entry, cwd, read, env) : [] })
    } catch (e) {
      console.error(`naima: ${message(e)}`)
      return 2
    }
    const child = new Deno.Command(Deno.execPath(), {
      args: ["run", "--no-prompt", "--no-config", "--no-lock", ...flags, join(entry, "src", "cli.ts"), ...args],
      cwd,
      clearEnv: true,
      env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn()
    const { code } = await child.status
    if (code !== RELAUNCH) return code
    entry = program
  }
  console.error(`naima: ${program} did not settle after ${MAX_RUNS} runs — its alignment keeps moving`)
  return 2
}
