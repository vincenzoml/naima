// Where Naima lives in a project, and how a run finds it.
//
//   naima-tracker/              the one folder Naima owns in a project
//     README.md                 one line: what Naima is, and a link
//     .gitignore                ignores naima/ when the program is a gitignored copy
//     naima/                    the program: a copy of Naima's naima/, locked by commit
//     naima-data/               the data: the items, and naima.json
//       naima.json              the anchor: the data format, the lock, the project's facts
//
// Both directories can move (docs/reference/format.md); the anchor is always a
// naima.json that carries `format`.

import { existsSync, realpathSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"

export const TRACKER_DIR = "naima-tracker"
export const DATA_DIR = "naima-data"
export const PROGRAM_DIR = "naima"
export const DATA_FILE = "naima.json"
/** The data directory, from the project root, unless moved. */
export const DEFAULT_DATA = `${TRACKER_DIR}/${DATA_DIR}`
/** The program directory, from the data directory, unless `program` moves it. */
export const DEFAULT_PROGRAM = `../${PROGRAM_DIR}`

/** The runtime folder of Naima's repository: what a program directory holds a copy of. */
export const RUNTIME_DIR = "naima"

/** The file a copied program holds besides the runtime files: the source, the commit and each file's git blob id it is a copy of. */
export const COPY_FILE = ".naima-copy.json"

/**
 * Where a program directory's code is: the directory itself when it holds a
 * copy of naima/ (or a clone of a commit that held the runtime at its top),
 * its naima/ when it holds a whole commit of Naima's main (a submodule). Null
 * when it holds neither.
 */
export function runtimeOf(program: string): string | null {
  for (const dir of [program, join(program, RUNTIME_DIR)]) if (existsSync(join(dir, "src", "cli.ts"))) return dir
  return null
}

/**
 * The per-user cache commits are fetched into, shared by every project and
 * worktree of the user: NAIMA_CACHE when set, else the platform's cache
 * directory. Null when the environment names no home.
 */
export function cacheDir(env: Record<string, string | undefined>, os: string): string | null {
  if (env["NAIMA_CACHE"]) return resolve(env["NAIMA_CACHE"])
  if (os === "windows") {
    const base = env["LOCALAPPDATA"] ?? env["APPDATA"]
    return base ? join(base, "naima", "cache") : null
  }
  if (os === "darwin") return env["HOME"] ? join(env["HOME"], "Library", "Caches", "naima") : null
  if (env["XDG_CACHE_HOME"]) return join(env["XDG_CACHE_HOME"], "naima")
  return env["HOME"] ? join(env["HOME"], ".cache", "naima") : null
}

/** Naima's home, linked from every tracker's README. */
export const HOME = "https://github.com/vincenzoml/naima"
/** What Naima is, in one sentence after its name: shared by Naima's README and every tracker's. */
export const ABOUT = "is a silent software house of AI agents: it turns vibe coding into an exact science."
/** `naima-tracker/README.md`, as `naima init` writes it. */
export const TRACKER_README = `[Naima](${HOME}) ${ABOUT}\n`

/**
 * The exit code with which a program asks the launcher to run it again: it
 * has just aligned the program directory, so the code that should run is on
 * disk and not the code that is running.
 */
export const RELAUNCH = 75

/**
 * The data directory: `given` (the `--data` flag, or `NAIMA_DATA`) resolved
 * from `cwd`, or the first `naima-tracker/naima-data/` holding a naima.json
 * found walking up from `cwd`. Null when there is none.
 */
export function findData(cwd: string, given?: string): string | null {
  if (given) return resolve(cwd, given)
  let dir = resolve(cwd)
  for (;;) {
    const data = join(dir, TRACKER_DIR, DATA_DIR)
    if (existsSync(join(data, DATA_FILE))) return data
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * The tracker folder of a data directory: `naima-tracker/` when the data is
 * inside one, else the data directory itself. It bounds what Naima writes, so
 * a data directory moved to the project root never widens it to the project.
 */
export const trackerOf = (data: string): string => (basename(dirname(data)) === TRACKER_DIR ? dirname(data) : data)

/** A path with its symlinks resolved, as git names it; resolved only, when it does not exist yet. */
export const real = (path: string): string => (existsSync(path) ? realpathSync(path) : resolve(path))

/**
 * `naima [--data <dir>] <command> [args]`: the one global option, which comes
 * first. The launcher and the program both read it, through this one parser.
 */
export function globalOptions(argv: string[]): { data?: string; rest: string[] } {
  const [first, second, ...rest] = argv
  if (first === "--data") {
    if (!second) throw new Error("--data needs a directory")
    return { data: second, rest }
  }
  if (first?.startsWith("--data=")) {
    const data = first.slice("--data=".length)
    if (!data) throw new Error("--data needs a directory")
    return { data, rest: argv.slice(1) }
  }
  return { rest: argv }
}
