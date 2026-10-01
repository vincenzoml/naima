// The one entry point: find the data, align the program when the launcher
// runs it, load every plugin, dispatch. The commands that set up and move the
// program itself — init, update, carry, guide, help — are answered here,
// before any plugin is loaded.

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { CARRY_MODES, type Lock, parseLock, posixRelative, programDir, readRaw, sourceRefusal, writeRaw } from "./config.ts"
import { consoleIO, type IO, type Place } from "./context.ts"
import { cliCommands } from "./entry.ts"
import { FORMAT, formatRefusal, isFormat, migrate, MIGRATIONS, type Step } from "./format.ts"
import { formatsFor, type OpenOptions, openProject, owed } from "./project.ts"
import { bool, parse } from "./args.ts"
import { gitOrNull, nativePath, toplevel } from "./git.ts"
import { exclusions } from "./excludes.ts"
import {
  DATA_DIR,
  DATA_FILE,
  DEFAULT_DATA,
  DIST_BRANCH,
  findData,
  globalOptions,
  PROGRAM_DIR,
  real,
  RELAUNCH,
  RUNTIME_DIR,
  runtimeOf,
  TRACKER_DIR,
  TRACKER_README,
  trackerOf,
} from "./layout.ts"
import {
  align,
  carry,
  ignoreProgram,
  localWork,
  refuseLocalWork,
  remoteHead,
  short,
  SOURCE_CHANGED,
  stage,
  type Target,
  vendor,
  withoutCredentials,
} from "./program.ts"
import { EXIT, isInternal, message, NaimaError } from "./errors.ts"
import type { Carry, Command, Context, GuideSection } from "./types.ts"
import { asRendered, linesAs } from "./rendered.ts"
import { shortOrId } from "./names.ts"
import { apiFor } from "./plugins.ts"

export interface CliOptions extends OpenOptions {
  cwd: string
  /** The Naima that is running: the directory holding its naima.ts and src/. */
  programRoot: string
  /** The data directory named by `NAIMA_DATA`, if any; `--data` wins over it. */
  data?: string
  /** Run by the launcher: align the program first, and ask to be run again when the code on disk is not the code running. */
  launched?: boolean
  io?: IO
  /** Print the stack of an internal error (NAIMA_DEBUG=1). */
  debug?: boolean
}

const usage = (name: string): string => `usage: naima ${cliCommands.find((c) => c.name === name)?.usage ?? name}`

/**
 * The commit of the running Naima, when it is a clone of its own — of a dist commit, or of a main commit whose naima/ runs;
 * null when it is vendored into a project.
 */
function runningCommit(programRoot: string): string | null {
  // git always prints --show-toplevel with forward slashes, even on Windows, where real(programRoot)
  // (node:fs) uses backslashes: without nativePath() the two never compared equal there, so a fresh
  // Windows clone was never recognized as its own clone (naima: this Naima is not a clone with an origin).
  const gitTop = toplevel(programRoot)
  const top = gitTop === null ? null : nativePath(gitTop)
  const own = top !== null && (top === real(programRoot) || join(top, RUNTIME_DIR) === real(programRoot))
  return own ? gitOrNull(programRoot, "rev-parse", "HEAD") : null
}

function locate(opts: CliOptions, flag: string | undefined): (Place & { lock: Lock; raw: Record<string, unknown> }) | null {
  const found = findData(opts.cwd, flag ?? opts.data)
  if (!found) return null
  if (!existsSync(join(found, DATA_FILE))) throw new Error(`${found} holds no ${DATA_FILE}`)
  const data = real(found) // as git names the root: relative paths between the two must not cross a symlink
  const raw = readRaw(data)
  if (!isFormat(raw["format"])) throw new Error(`${DATA_FILE} ${formatRefusal(raw["format"])}`)
  const lock = parseLock(raw)
  return { root: toplevel(data) ?? dirname(dirname(data)), data, program: programDir(data, lock), lock, raw }
}

const targetOf = (place: Place, lock: Lock): Target => ({
  root: place.root,
  tracker: trackerOf(place.data),
  program: place.program,
  source: lock.source,
  commit: lock.commit,
  carry: lock.carry,
  ...(lock.verify ? { verify: lock.verify } : {}),
})

export { withoutCredentials }

/** The command init names as the next step: a type the loaded plugins really let one create. */
async function nextStep(place: Place, opts: CliOptions, io: IO): Promise<string> {
  try {
    const ctx = await openProject(place, opts, io)
    const type = [...ctx.registry.types.values()].find((t) => t.creatable !== false)
    return type ? `next: naima new ${type.id} "<the first thing to do>"` : "next: naima help"
  } catch {
    return "next: naima check" // it says what is wrong with the project
  }
}

/** Print, and with --write-excludes write, the lines that keep the program out of the host's own tools. */
function excludeHost(root: string, program: string, write: boolean, io: IO): void {
  for (const x of exclusions(root, posixRelative(root, program))) {
    if (x.present) continue
    if (!write) io.out(`exclude from ${x.file}: ${x.line}   (naima init --write-excludes adds it)`)
    else if (x.write()) io.out(`wrote ${x.file}: ${x.line}`)
    else io.out(`not written, it is not plain JSON — add by hand to ${x.file}: ${x.line}`)
  }
}

async function init(args: string[], opts: CliOptions, io: IO): Promise<number> {
  const write = bool(parse(args, { "write-excludes": { type: "boolean" } }), "write-excludes")
  const root = toplevel(resolve(opts.cwd))
  if (!root) throw new Error("not a git repository — naima init makes a git repository a Naima project")
  const tracker = join(root, TRACKER_DIR)
  const data = join(tracker, DATA_DIR)
  const program = join(tracker, PROGRAM_DIR)
  if (existsSync(join(data, DATA_FILE))) {
    io.out(`${DEFAULT_DATA}/${DATA_FILE} already exists — left as it is`)
    excludeHost(root, programDir(data, parseLock(readRaw(data))), write, io)
    io.out(await nextStep({ root, data: real(data), program: programDir(data, parseLock(readRaw(data))) }, opts, io))
    return 0
  }
  const commit = runningCommit(opts.programRoot)
  const origin = commit && gitOrNull(opts.programRoot, "remote", "get-url", "origin")
  if (!commit || !origin) {
    throw new Error(
      `this Naima is not a clone with an origin: naima init records the source and commit of the Naima that runs it — git clone --branch ${DIST_BRANCH} <source> ${TRACKER_DIR}/naima, and run init from there`,
    )
  }
  const source = withoutCredentials(origin)
  const refusal = sourceRefusal(source)
  if (refusal) throw new Error(`the origin of ${opts.programRoot} cannot be a lock's source: it ${refusal}`)
  // Everyone else must be able to fetch what is locked: nothing uncommitted, nothing its origin lacks.
  const work = localWork({ root, tracker, program: opts.programRoot, source, commit, carry: "clone" })
  if (work) {
    throw new Error(`the Naima that runs init has ${work}, so nobody else could run the commit it would lock — push it to its origin, or clone a pushed one`)
  }
  mkdirSync(data, { recursive: true })
  const readme = join(tracker, "README.md")
  if (!existsSync(readme)) writeFileSync(readme, TRACKER_README)
  const formats = formatsFor(opts.firstParty.map((p) => p.factory({}, apiFor(p.name, { rename: {} }))))
  writeRaw(data, { format: FORMAT, ...(Object.keys(formats).length ? { formats } : {}), source, commit, carry: "clone" })
  ignoreProgram({ root, tracker, program, source, commit, carry: "clone" }, true)
  io.out(`wrote ${TRACKER_DIR}/: README.md, .gitignore, ${DATA_DIR}/${DATA_FILE} — locked to ${source} at ${short(commit)}`)
  excludeHost(root, program, write, io)
  io.out(await nextStep({ root, data: real(data), program }, opts, io))
  return 0
}

/** What `naima update` says it migrated: the core's format, then each plugin's own. */
function migrated(steps: readonly Step[], from: unknown, plugins: readonly { plugin: string | null; migrations: readonly unknown[] }[]): string[] {
  if (!steps.length) return [`the data is format ${FORMAT}: nothing to migrate`]
  const out = steps.some((s) => s.plugin === null) ? [`migrated the data from format ${String(from)} to ${FORMAT}`] : []
  for (const p of plugins) {
    const mine = steps.filter((s) => s.plugin === p.plugin)
    if (mine.length) out.push(`migrated ${p.plugin}'s data from its format ${mine[0]?.from} to ${1 + p.migrations.length}`)
  }
  return out
}

async function update(args: string[], opts: CliOptions, place: Place, lock: Lock, raw: Record<string, unknown>, io: IO): Promise<number> {
  const p = parse(args, { check: { type: "boolean" }, "accept-source": { type: "boolean" } })
  const check = bool(p, "check")
  if (check && bool(p, "accept-source")) throw new Error(usage("update"))
  if (bool(p, "accept-source")) {
    // The entry point has aligned the program to the new source already: accepting it is all this asks.
    io.out(`trusted ${lock.source} at the locked commit ${short(lock.commit)}; nothing else moved`)
    return 0
  }
  const t = targetOf(place, lock)
  const head = remoteHead(t)
  const main = head.commit
  if (check) {
    if (main === lock.commit) io.out(`current: the source's ${head.branch} is the locked commit ${short(main)}`)
    else io.out(`the source's ${head.branch} moved: ${short(lock.commit)} → ${short(main)} — naima update`)
    return main === lock.commit ? 0 : 1
  }
  if (main !== lock.commit) {
    // Move the program first, and only then the lock: a refusal leaves both where they were.
    if (lock.carry === "vendored") {
      refuseLocalWork(t)
      vendor(t, main)
    } else align({ ...t, commit: main })
    writeRaw(place.data, { ...raw, commit: main })
    io.out(`locked ${short(lock.commit)} → ${short(main)}`)
    return RELAUNCH // the new Naima finishes: it is the one that knows the new format
  }
  const from = raw["format"]
  const { all } = await owed(raw, place, opts)
  const steps = migrate(place.data, MIGRATIONS, all.slice(1))
  for (const line of migrated(steps, from, all.slice(1))) io.out(line)
  const tracker = posixRelative(place.root, trackerOf(place.data))
  io.out(`${short(main)} is the lock — commit it as one change: git add ${tracker} && git commit -m "Update Naima to ${short(main)}"`)
  return 0
}

function carryCommand(args: string[], place: Place, lock: Lock, raw: Record<string, unknown>, io: IO): number {
  const [to, ...extra] = parse(args).positionals
  if (!to || extra.length || !CARRY_MODES.includes(to as Carry)) throw new Error(usage("carry"))
  if (to === lock.carry) {
    io.out(`already carried as ${to}`)
    return 0
  }
  carry(targetOf(place, lock), to as Carry)
  writeRaw(place.data, { ...raw, carry: to })
  stage(place.root, join(place.data, DATA_FILE))
  io.out(`carried as ${to} (was ${lock.carry}), staged — commit it as one change: git commit -m "Carry Naima as ${to}"`)
  return 0
}

/** What `naima guide` points at, from the program root: all of it ships in the dist. */
export const GUIDE_PAGES: readonly (readonly [string, string])[] = [
  ["skill", "skills/naima/SKILL.md"],
  ["index", "docs/README.md"],
  ["guide", "docs/guide/README.md"],
  ["rulebook", "docs/guide/rules.md"],
  ["agents", "docs/agents/README.md"],
  ["format", "docs/reference/format.md"],
  ["install", "docs/guide/install.md"],
]

/** The guide sections the project's plugins contribute, as lines; none outside a project, and none when it does not open (`naima check` says why). */
async function guideSections(opts: CliOptions, data: string | undefined, io: IO): Promise<string[]> {
  let ctx: Context
  try {
    const place = locate(opts, data)
    if (!place) return []
    ctx = await openProject(place, opts, io)
  } catch (e) {
    io.err(`naima: the project's guide sections are not shown: ${message(e)} — naima check`)
    return []
  }
  const out: string[] = []
  for (const c of ctx.registry.contributions("guide")) {
    const lines = linesAs(asRendered(await (c.value as GuideSection).render(ctx), `guide section "${c.name}"`), "text")
    if (lines.length) out.push(...lines, "")
  }
  return out
}

async function guide(opts: CliOptions, data: string | undefined, io: IO): Promise<number> {
  for (const line of await guideSections(opts, data, io)) io.out(line)
  const at = (path: string): string => relative(opts.cwd, join(opts.programRoot, path)) || "."
  const commit = runningCommit(opts.programRoot)
  io.out(`Naima ${commit ? commit.slice(0, 12) : "(vendored)"}, data format ${FORMAT}, at ${at("")}`)
  io.out("Read these as files; they are the documentation of the Naima that runs:")
  for (const [name, path] of GUIDE_PAGES) io.out(`  ${name.padEnd(8)} ${at(path)}`)
  return 0
}

function help(ctx: Context | null, io: IO): number {
  io.out("usage: naima [--data <dir>] <command> [args]\n")
  const entry = cliCommands.filter((c) => c.name !== "help")
  for (const c of entry) io.out(`  ${c.name.padEnd(10)} ${c.says}\n  ${"".padEnd(10)} naima ${c.usage}`)
  if (!ctx) {
    io.out(`\nno ${DEFAULT_DATA}/${DATA_FILE} found here or above — run naima init`)
    return 0
  }
  for (const c of ctx.registry.contributions("commands")) {
    const cmd = c.value as Command
    const name = shortOrId(ctx, "commands", c)
    io.out(`  ${name.padEnd(10)} ${cmd.says}\n  ${"".padEnd(10)} naima ${name === c.name ? cmd.usage : cmd.usage.replace(c.name, name)}`)
  }
  return 0
}

const isHelp = (command: string | undefined): boolean => !command || command === "help" || command === "--help" || command === "-h"

export async function runCli(argv: string[], opts: CliOptions): Promise<number> {
  const io = opts.io ?? consoleIO
  try {
    const { data, rest } = globalOptions(argv)
    const [command, ...args] = rest
    if (command === "init") {
      if (args.some((a) => a !== "--write-excludes")) throw new Error(usage("init"))
      return await init(args, opts, io)
    }
    if (command === "guide") return await guide(opts, data, io)
    const place = locate(opts, data)
    if (!place) {
      if (isHelp(command)) return help(null, io)
      throw new Error(`no ${DEFAULT_DATA}/${DATA_FILE} found here or above — run naima init`)
    }
    if (opts.launched) {
      const acceptSource = command === "update" && args.includes("--accept-source")
      let moved = null
      try {
        moved = align({ ...targetOf(place, place.lock), acceptSource })
      } catch (e) {
        // update --check only reads the source: it answers whatever program runs it.
        const readOnly = command === "update" && args.includes("--check")
        if (!(readOnly && e instanceof NaimaError && e.code === SOURCE_CHANGED)) throw e
      }
      if (moved?.from && moved.from !== place.lock.commit) io.err(`naima: locked commit moved ${short(moved.from)} → ${short(place.lock.commit)}`)
      if (moved || real(opts.programRoot) !== real(runtimeOf(place.program) ?? place.program)) return RELAUNCH
    }
    if (command === "update" || command === "carry") {
      if (!opts.launched) {
        throw new Error(`naima ${command} moves the program, so it runs through the launcher: deno run -A ${TRACKER_DIR}/naima/naima.ts ${command}`)
      }
      return command === "update" ? await update(args, opts, place, place.lock, place.raw, io) : carryCommand(args, place, place.lock, place.raw, io)
    }
    const ctx = await openProject(place, opts, io)
    if (isHelp(command)) return help(ctx, io)
    const cmd = ctx.registry.find<Command>("commands", command as string)?.value
    if (!cmd) throw new Error(`unknown command "${command}" — naima help`)
    const code = await cmd.run(args, ctx)
    if (code !== RELAUNCH) return code
    // Only the entry point asks for a relaunch; a command's 75 would make the launcher run it again.
    io.err(`naima: ${command} exited ${RELAUNCH}, the code reserved for asking the launcher to relaunch — reported as ${EXIT.FAILED}`)
    return EXIT.FAILED
  } catch (e) {
    if (!isInternal(e)) {
      io.err(`naima: ${message(e)}`)
      return EXIT.USAGE
    }
    const name = e instanceof Error ? `${e.name}: ` : ""
    io.err(`naima: internal error: ${name}${message(e)} — a bug in Naima or a plugin; NAIMA_DEBUG=1 prints where`)
    if (opts.debug && e instanceof Error && e.stack) io.err(e.stack)
    return EXIT.INTERNAL
  }
}
