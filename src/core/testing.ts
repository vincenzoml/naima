// A throwaway project for tests: a temp directory, a naima.json, a context
// whose output is captured and whose clock is fixed.

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { corePlugin } from "./base.ts"
import { createContext } from "./context.ts"
import { FORMAT } from "./format.ts"
import { mustGit } from "./git.ts"
import { writeJson } from "./item.ts"
import { DATA_FILE, DEFAULT_DATA, DEFAULT_PROGRAM } from "./layout.ts"
import { buildRegistry, type RegistryOptions } from "./registry.ts"
import type { Command, Context, Plugin } from "./types.ts"

// What a plugin's tests need of the core beyond the plugin API: a context over a project they build by hand.
export { createContext } from "./context.ts"
export { DEFAULT_PROGRAM } from "./layout.ts"

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

export const FIXED_NOW = new Date("2026-01-15T10:00:00.000Z")

export function tempProject(plugins: Plugin[], opts: { git?: boolean; now?: Date } & RegistryOptions = {}): TempProject {
  const root = mkdtempSync(join(tmpdir(), "naima-"))
  const data = join(root, DEFAULT_DATA)
  const lock = { source: "https://example.invalid/naima.git", commit: "0".repeat(40), carry: "clone" as const, program: DEFAULT_PROGRAM }
  const config = { format: FORMAT, formats: {}, ...lock, plugins: {}, rename: opts.rename ?? {}, extends: [] }
  writeJson(join(data, DATA_FILE), { format: FORMAT, source: lock.source, commit: lock.commit, carry: lock.carry })
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
