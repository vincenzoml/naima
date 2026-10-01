// Where Naima lives in a project, and how a run finds it.
//
//   naima-tracker/              the one folder Naima owns in a project
//     README.md                 one line: what Naima is, and a link
//     .gitignore                ignores naima/ when the program is a clone
//     naima/                    the program: a clone of Naima, locked by commit
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

/**
 * The branch of Naima's repository that holds only what runs Naima, built by
 * CI from every commit of main: what a project clones and locks, and what
 * `naima update` follows when the source has it (docs/guide/install.md#the-dist-branch).
 */
export const DIST_BRANCH = "dist"

/** Naima's home, linked from every tracker's README. */
export const HOME = "https://github.com/vincenzoml/naima"
/** What Naima is, in one sentence after its name: shared by Naima's README and every tracker's. */
export const ABOUT =
  "is a project tracker for software built by people and AI agents together: bugs, work, features, tests and the proofs that close them, kept as plain files in the repository and checked like code."
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
