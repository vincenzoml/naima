// A throwaway project for tests: a temp directory, a naima.json, a context
// whose output is captured and whose clock is fixed.

import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { corePlugin } from "../../naima/src/core/base.ts"
import { createContext } from "../../naima/src/core/context.ts"
import { FORMAT } from "../../naima/src/core/format.ts"
import { mustGit } from "../../naima/src/core/git.ts"
import { writeJson } from "../../naima/src/core/item.ts"
import { DATA_FILE, DEFAULT_DATA, DEFAULT_PROGRAM } from "../../naima/src/core/layout.ts"
import { DEFAULT_ENTRY_FILES } from "../../naima/src/core/pointer.ts"
import { buildRegistry, type RegistryOptions } from "../../naima/src/core/registry.ts"
import type { Command, Context, Plugin } from "../../naima/src/core/types.ts"

// What a plugin's tests need of the core beyond the plugin API: a context over a project they build by hand.
export { createContext } from "../../naima/src/core/context.ts"
export { DEFAULT_PROGRAM } from "../../naima/src/core/layout.ts"

export interface TempProject {
  root: string
  ctx: Context
  output: string[]
  errors: string[]
  /** Run a registered command; output lands in `output`. */
  run(command: string, ...args: string[]): Promise<number>
  git(...args: string[]): string
  cleanup(): void
}

/**
 * An author for commits made by tests, so they never depend on the machine's git configuration; and no
 * automatic maintenance. A commit starts `git maintenance run --auto` detached, which may repack and delete
 * loose objects while the test goes on: a local clone listing the object directory then finds a file gone
 * ("failed to copy file to '…/objects/…': No such file or directory"), as git 2.55 on the macOS runner did.
 */
const IDENTITY = [
  "-c",
  "user.email=test@example.invalid",
  "-c",
  "user.name=test",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "maintenance.auto=false",
  "-c",
  "gc.auto=0",
]

/** Git in `cwd` for a test, with a fixed author and no background maintenance: the output, trimmed; an error with git's reason on failure. */
export const gitIn = (cwd: string, ...args: string[]): string => mustGit(cwd, ...IDENTITY, ...args)

/** Remove a test's temporary directory, unless NAIMA_KEEP_TEMP=1 (scripts/coverage.ts reads the copies it holds). */
export const removeTemp = (dir: string): void => {
  if (process.env["NAIMA_KEEP_TEMP"] !== "1") rmSync(dir, { recursive: true, force: true })
}

/** Every file of `repo` that git tracks or would track, and that is on disk: what a commit of it would hold. */
export function trackedFiles(repo: string): string[] {
  return gitIn(repo, "ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0").filter((p) => p && existsSync(join(repo, p)))
}

/**
 * A repository at `dir` with one commit on main holding `files` of `from` —
 * by default every file of it: Naima's source as a project fetches it, with
 * its tests, its tracker and its agent rules beside naima/.
 */
export function sourceRepo(from: string, dir: string, files: string[] = trackedFiles(from)): string {
  for (const f of files) {
    const to = join(dir, f)
    mkdirSync(dirname(to), { recursive: true })
    if (lstatSync(join(from, f)).isSymbolicLink()) symlinkSync(readlinkSync(join(from, f)), to)
    else copyFileSync(join(from, f), to)
  }
  gitIn(dir, "init", "-q", "-b", "main")
  gitIn(dir, "add", "-A")
  gitIn(dir, "commit", "-q", "-m", "Naima")
  return dir
}

/** This checkout's runtime folder, naima/: what the product holds at its top. */
export const RUNTIME = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "naima")

/** The files of the product: every file of naima/ git tracks or would track, by its path in naima/ (`git -C naima ls-files`). */
export const productFiles = (): string[] => trackedFiles(RUNTIME)

/**
 * The product as a git repository at `dir`, with its main at a commit holding
 * the files of naima/ at its top — the product layout, so a test passes before
 * and after the split. With `oldLayout`, main first holds a commit of the old
 * layout — the same files under naima/, beside the development material — and
 * then the commit that moves them to the top, as the product's history has.
 * `extra` files (path → text) are added to the product commit.
 */
export function productRepo(
  dir: string,
  opts: { oldLayout?: boolean; extra?: Record<string, string> } = {},
): { dir: string; old: string | null; head: string } {
  const files = productFiles()
  const put = (prefix: string) => {
    for (const f of files) {
      const to = join(dir, prefix, f)
      mkdirSync(dirname(to), { recursive: true })
      if (lstatSync(join(RUNTIME, f)).isSymbolicLink()) symlinkSync(readlinkSync(join(RUNTIME, f)), to)
      else copyFileSync(join(RUNTIME, f), to)
    }
  }
  mkdirSync(dir, { recursive: true })
  gitIn(dir, "init", "-q", "-b", "main")
  let old: string | null = null
  if (opts.oldLayout) {
    put("naima")
    writeFileSync(join(dir, "AGENTS.md"), "Naima's own development rules.\n")
    gitIn(dir, "add", "-A")
    gitIn(dir, "commit", "-q", "-m", "Naima, the old layout")
    old = gitIn(dir, "rev-parse", "HEAD")
    gitIn(dir, "rm", "-q", "-r", "--", "naima", "AGENTS.md")
  }
  put("")
  for (const [f, text] of Object.entries(opts.extra ?? {})) {
    mkdirSync(dirname(join(dir, f)), { recursive: true })
    writeFileSync(join(dir, f), text)
  }
  gitIn(dir, "add", "-A")
  gitIn(dir, "commit", "-q", "-m", "Naima")
  return { dir, old, head: gitIn(dir, "rev-parse", "HEAD") }
}

/** The data of the project around `cwd`: its git root's naima-tracker/naima-data, as in-process tests name it with --data. */
export function dataOf(cwd: string): string {
  const r = spawnGitTop(cwd)
  return join(r ?? cwd, DEFAULT_DATA)
}

const spawnGitTop = (cwd: string): string | null => {
  try {
    return gitIn(cwd, "rev-parse", "--show-toplevel")
  } catch {
    return null
  }
}

export const FIXED_NOW = new Date("2026-01-15T10:00:00.000Z")

export function tempProject(plugins: Plugin[], opts: { git?: boolean; now?: Date } & RegistryOptions = {}): TempProject {
  const root = mkdtempSync(join(tmpdir(), "naima-"))
  const data = join(root, DEFAULT_DATA)
  const lock = { source: "https://example.invalid/naima.git", commit: "0".repeat(40), program: DEFAULT_PROGRAM }
  const config = { format: FORMAT, formats: {}, ...lock, plugins: {}, rename: opts.rename ?? {}, extends: [], entryFiles: [...DEFAULT_ENTRY_FILES] }
  writeJson(join(data, DATA_FILE), { format: FORMAT, source: lock.source, commit: lock.commit })
  const output: string[] = []
  const errors: string[] = []
  const now = opts.now ?? FIXED_NOW
  const ctx = createContext({ root, data, program: join(data, DEFAULT_PROGRAM) }, config, buildRegistry([corePlugin, ...plugins], opts), {
    out: (line = "") => void output.push(line),
    err: (line) => void errors.push(line),
    now: () => now,
  })
  const git = (...args: string[]): string => gitIn(root, ...args)
  if (opts.git) {
    git("init", "-q", "-b", "main")
    git("config", "user.email", "test@example.invalid")
    git("config", "user.name", "test")
    git("config", "commit.gpgsign", "false")
    git("add", "-A")
    git("commit", "-q", "-m", "init")
  }
  return {
    root,
    ctx,
    output,
    errors,
    run(command, ...args) {
      // A promise either way: a command that throws before it returns is a rejection, as it is to runCli.
      return new Promise<number>((done) => {
        const cmd = ctx.registry.find<Command>("commands", command)?.value
        if (!cmd) throw new Error(`no command ${command}`)
        ctx.reload()
        done(cmd.run(args, ctx))
      })
    },
    git,
    cleanup: () => removeTemp(root),
  }
}
