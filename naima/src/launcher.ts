// The launcher: the one piece of Naima that runs with every permission, and
// all it does is work out where things are, then run the program under Deno
// with only these (docs/guide/install.md says why each one exists):
//
//   read    the repository, the program wherever it is, the per-user cache, and the data directory of every other worktree
//   write   the tracker folder (naima-tracker/), the data and program if moved out of it, and the per-user cache
//   run     git, and the programs the loaded contributions declare (`runs`: a verifier's tool, a metric's command), nothing else
//   env     an allow-list of the environment (ENV below): what git needs, and Naima's own
//   net     none: the network is git's, for alignment and update — except for `naima ui` (UI below)
//
// `naima ui`, and no other command, may also listen on the loopback interface,
// read and run the Deno that runs it — to open its window, a process of its
// own with the webview's permissions (src/plugins/ui/open.ts) — and run the
// program that opens the default browser.
//
// When the program exits with RELAUNCH it has just aligned the program
// directory, so the code on disk is not the code that ran: the launcher runs
// the program directory's own code, which is the locked commit.
//
// The per-user cache is where the locked commits are fetched before they are
// copied into the program (src/core/program.ts): the launcher names it to the
// program as NAIMA_CACHE.

import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  cacheDir,
  DATA_FILE,
  DEFAULT_ENTRY_FILES,
  EXCLUDE_FILES,
  findData,
  globalOptions,
  message,
  PROGRAM_DIR,
  programOf,
  readConfig,
  real,
  RELAUNCH,
  runtimeOf,
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

/** What `naima ui` is granted besides the rest: the loopback interface, the Deno that opens its window, and the browser's opener. */
export interface UiGrant {
  net: string[]
  read: string[]
  runs: string[]
}

/** The program that opens the default browser, by operating system: the same src/plugins/ui/open.ts starts. */
export const BROWSER_OPENER: Record<string, string> = { darwin: "open", windows: "rundll32", linux: "xdg-open" }

/** The grant of `command`: only `ui` has one. */
export function uiGrant(command: string | undefined, os: string, deno: string): UiGrant | null {
  if (command !== "ui") return null
  return { net: ["127.0.0.1"], read: [deno], runs: [deno, BROWSER_OPENER[os] ?? "xdg-open"] }
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
    /** The per-user cache, read and written: null when there is none. */
    cache?: string | null
    hostFiles?: string[]
    worktrees?: string[]
    /** The programs the loaded contributions start, besides git: a verifier's `runs`, a metric's program. */
    runs?: string[]
    /** What `naima ui` is granted besides: null for every other command. */
    ui?: UiGrant | null
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
    `--allow-read=${
      list([p.root, p.data, p.program, p.entry, p.cache ?? null, ...(p.worktrees ?? []).map(real).filter((x) => !x.includes(",")), ...(p.ui?.read ?? [])])
    }`,
    `--allow-write=${list([p.tracker, p.data, p.program, p.cache ?? null, ...(p.hostFiles ?? [])])}`,
    `--allow-run=${[...new Set(["git", ...(p.runs ?? []), ...(p.ui?.runs ?? [])])].join(",")}`,
    "--allow-env",
    ...(p.ui ? [`--allow-net=${p.ui.net.join(",")}`] : []),
  ]
}

/**
 * The data directory of every other worktree of the project, where each one's uncommitted records are: the
 * cross-branch views read them from disk (docs/agents/worktree-isolation.md). Only when the data is inside the project.
 */
function otherWorktrees(root: string, data: string | null): string[] {
  if (!data) return []
  const inside = relative(real(root), real(data))
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) return []
  return worktrees(root).filter((w) => !w.self).map((w) => join(w.path, inside))
}

/** The first-party plugins loaded only when the project's plugins table names them: each starts a program. Kept equal to builtins.ts's `optIn` by a test. */
export const OPT_IN: readonly string[] = ["verifier-mcrl2", "verifier-voxlogica"]

/** An entry of the plugins table that switches its plugin on: present, and not `enabled: false`. */
const isOn = (e: unknown): boolean => !!e && typeof e === "object" && (e as { enabled?: unknown }).enabled !== false

/**
 * May the loaded contributions start a program besides git? Only when the
 * project loads code the program does not ship — a third-party plugin, or a
 * replacement for a first-party one — or declares metrics, each naming the
 * program that measures it, or switches on a first-party plugin that is off
 * until asked for (`OPT_IN`), each starting a model checker: no other
 * first-party contribution starts one.
 * Read in every format: a list of plugins (format 1), or a table whose entries
 * name a source or a replacement, or give the metrics plugin metrics.
 */
export function mayRun(data: string | null): boolean {
  if (!data) return false
  try {
    const plugins = (JSON.parse(readFileSync(join(data, DATA_FILE), "utf8")) as { plugins?: unknown }).plugins
    if (Array.isArray(plugins)) return plugins.length > 0
    if (!plugins || typeof plugins !== "object") return false
    const metrics = (plugins as { metrics?: { options?: { metrics?: unknown } } }).metrics?.options?.metrics
    if (metrics && typeof metrics === "object" && Object.keys(metrics).length) return true
    const entries = plugins as Record<string, unknown>
    if (OPT_IN.some((name) => isOn(entries[name]))) return true
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

/** The project's configured `entryFiles`, or the sensible defaults: `data` may hold no naima.json yet, or one this Naima cannot parse. */
function entryFilesOf(data: string | null): readonly string[] {
  if (!data || !existsSync(join(data, DATA_FILE))) return DEFAULT_ENTRY_FILES
  try {
    return readConfig(data).entryFiles
  } catch {
    return DEFAULT_ENTRY_FILES
  }
}

/** The host files the run may write outside the tracker folder: only `init --write-excludes` and `init --write-agent-pointer` have any. */
function hostFiles(rest: string[], root: string, data: string | null): string[] {
  const [command, ...args] = rest
  if (command !== "init") return []
  return [
    ...(args.includes("--write-excludes") ? EXCLUDE_FILES.map((f) => join(root, f)) : []),
    ...(args.includes("--write-agent-pointer") ? entryFilesOf(data).map((f) => join(root, f)) : []),
  ]
}

/**
 * The per-user cache, made when it does not exist yet; null when the
 * environment names none, it cannot be made, or its path holds a comma —
 * then the program fetches into a scratch repository in the tracker folder.
 */
function userCache(): string | null {
  const dir = cacheDir(Deno.env.toObject(), Deno.build.os)
  if (!dir || dir.includes(",")) return null
  try {
    mkdirSync(dir, { recursive: true })
    return real(dir)
  } catch {
    return null
  }
}

export async function launch(args: string[], cwd: string): Promise<number> {
  let parsed: ReturnType<typeof globalOptions>
  try {
    parsed = globalOptions(args)
  } catch {
    parsed = { rest: args } // the program says what is wrong with the arguments
  }
  // Resolved: Deno grants real paths, and the program reads its own directory, which may not be the project's.
  const own = real(dirname(dirname(fileURLToPath(import.meta.url))))
  const data = findData(cwd, parsed.data ?? Deno.env.get("NAIMA_DATA"))
  const root = toplevel(data ?? cwd) ?? resolve(cwd)
  const tracker = data ? trackerOf(data) : join(root, TRACKER_DIR)
  const program = data && existsSync(join(data, DATA_FILE)) ? programOf(data) : join(tracker, PROGRAM_DIR)
  const cache = userCache()
  const env = { ...allowedEnv(Deno.env.toObject()), NAIMA_LAUNCHED: "1", ...(data ? { NAIMA_DATA: data } : {}), ...(cache ? { NAIMA_CACHE: cache } : {}) }
  const others = otherWorktrees(root, data)
  const ui = uiGrant(parsed.rest[0], Deno.build.os, Deno.execPath())
  let entry = runtimeOf(program) ?? own
  for (let run = 0; run < MAX_RUNS; run++) {
    let flags: string[]
    try {
      const fence = { root, tracker, data, program, entry, cache, hostFiles: hostFiles(parsed.rest, root, data), worktrees: others }
      const read = permissions(fence)[0] ?? ""
      flags = permissions({ ...fence, runs: mayRun(data) ? declaredRuns(entry, cwd, read, env) : [], ui })
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
    // Ctrl-C reaches the program too, which stops `naima ui`'s server and says how it ended: wait for it.
    const wait = () => {}
    if (ui) Deno.addSignalListener("SIGINT", wait)
    const { code } = await child.status
    if (ui) Deno.removeSignalListener("SIGINT", wait)
    if (code !== RELAUNCH) return code
    entry = runtimeOf(program) ?? program
  }
  console.error(`naima: ${program} did not settle after ${MAX_RUNS} runs — its alignment keeps moving`)
  return 2
}
