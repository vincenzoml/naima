// The one entry point: find the data, align the program when the launcher
// runs it, load every plugin, dispatch. The commands that set up and move the
// program itself — init, update, carry, guide, help — are answered here,
// before any plugin is loaded.

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { CARRY_MODES, DEFAULT_CARRY, type Lock, parseLock, posixRelative, programDir, readRaw, sourceRefusal, withCarry, writeRaw } from "./config.ts"
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
  checkoutWork,
  COMMIT_UNAVAILABLE,
  copyProgram,
  ignoreProgram,
  localWork,
  lockedDistSource,
  readCopy,
  refuseLocalWork,
  remoteHead,
  short,
  SOURCE_CHANGED,
  stage,
  type Target,
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
  /** The per-user cache commits are fetched into (NAIMA_CACHE, which the launcher sets). */
  cache?: string
}

const usage = (name: string): string => `usage: naima ${cliCommands.find((c) => c.name === name)?.usage ?? name}`

/** What the running Naima is: the source and commit it is, and why nobody else could run that commit, if so. */
interface Running {
  commit: string
  source: string | null
  work: string | null
  /** The git repository holding it, when it is a clone: a repository on this disk that has the commit. */
  repo: string | null
}

/**
 * The running Naima, when it knows what it is: a copy names its source and
 * commit, a clone of Naima's repository runs its naima/ at HEAD. Null when it
 * is neither — a vendored copy committed before copies said what they were.
 */
function running(at: string): Running | null {
  // Resolved first: Deno grants the real path, and a file that does not exist cannot be resolved through a symbolic link.
  const programRoot = real(at)
  const copy = readCopy(programRoot)
  if (copy) {
    const work = localWork({ root: programRoot, tracker: programRoot, program: programRoot, source: copy.source, commit: copy.commit, carry: DEFAULT_CARRY })
    return { commit: copy.commit, source: copy.source, work, repo: null }
  }
  // git always prints --show-toplevel with forward slashes, even on Windows, where real(programRoot)
  // (node:fs) uses backslashes: without nativePath() the two never compared equal there, so a fresh
  // Windows clone was never recognized as its own clone (naima: this Naima is not a clone with an origin).
  const gitTop = toplevel(programRoot)
  const top = gitTop === null ? null : nativePath(gitTop)
  // Both resolved: on Windows a temporary folder may be named by its short 8.3 form on one side only.
  if (top === null || real(join(top, RUNTIME_DIR)) !== programRoot) return null
  const commit = gitOrNull(programRoot, "rev-parse", "HEAD")
  if (!commit) return null
  return { commit, source: gitOrNull(programRoot, "remote", "get-url", "origin"), work: checkoutWork(top), repo: top }
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

function targetOf(place: Place, lock: Lock, opts: CliOptions): Target {
  // The running Naima's clone holds the commit it runs: a copy made from it needs no network. Asked only when it is not the program.
  const elsewhere = real(opts.programRoot) !== real(runtimeOf(place.program) ?? place.program)
  const repo = elsewhere ? running(opts.programRoot)?.repo : null
  return {
    root: place.root,
    tracker: trackerOf(place.data),
    program: place.program,
    source: lock.source,
    commit: lock.commit,
    carry: lock.carry,
    ...(lock.verify ? { verify: lock.verify } : {}),
    ...(opts.cache ? { cache: opts.cache } : {}),
    ...(repo ? { seeds: [repo] } : {}),
  }
}

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
  const me = running(opts.programRoot)
  if (!me?.source) {
    throw new Error(
      `this Naima is neither a copy nor a clone with an origin: naima init records the source and commit of the Naima that runs it — git clone --depth 1 <source> <a folder outside the project>, and run its naima/naima.ts init from the project`,
    )
  }
  const { commit } = me
  const source = withoutCredentials(me.source)
  const refusal = sourceRefusal(source)
  if (refusal) throw new Error(`the origin of ${opts.programRoot} cannot be a lock's source: it ${refusal}`)
  // Everyone else must be able to fetch what is locked: nothing uncommitted, nothing its origin lacks.
  if (me.work) {
    throw new Error(`the Naima that runs init has ${me.work}, so nobody else could run the commit it would lock — push it to its origin, or clone a pushed one`)
  }
  mkdirSync(data, { recursive: true })
  const readme = join(tracker, "README.md")
  if (!existsSync(readme)) writeFileSync(readme, TRACKER_README)
  const formats = formatsFor(opts.firstParty.map((p) => p.factory({}, apiFor(p.name, { rename: {} }))))
  writeRaw(data, { format: FORMAT, ...(Object.keys(formats).length ? { formats } : {}), source, commit })
  const t: Target = {
    root,
    tracker,
    program,
    source,
    commit,
    carry: DEFAULT_CARRY,
    ...(opts.cache ? { cache: opts.cache } : {}),
    ...(me.repo ? { seeds: [me.repo] } : {}),
  }
  ignoreProgram(t, true)
  // Launched, init leaves the program in place; run directly, as a test, the first launched run copies it.
  const copied = opts.launched && real(opts.programRoot) !== real(program) ? (align(t), `, ${TRACKER_DIR}/${PROGRAM_DIR}/`) : ""
  io.out(`wrote ${TRACKER_DIR}/: README.md, .gitignore, ${DATA_DIR}/${DATA_FILE}${copied} — locked to ${source} at ${short(commit)}`)
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
  const t = targetOf(place, lock, opts)
  const head = remoteHead(t)
  const main = head.commit
  // A dist commit is named by the main commit it was built from: the same code, which update moves the lock to all the same.
  const dist = main === lock.commit ? null : lockedDistSource(t)
  const locked = dist ? `${short(lock.commit)} (the dist of ${short(dist)})` : short(lock.commit)
  if (check) {
    if (main === lock.commit) io.out(`current: the source's ${head.branch} is the locked commit ${short(main)}`)
    else if (dist === main) {
      io.out(`the lock names ${locked}, the code of the source's ${head.branch} as a dist commit — naima update locks ${head.branch} itself`)
    } else io.out(`the source's ${head.branch} moved: ${locked} → ${short(main)} — naima update`)
    return main === lock.commit ? 0 : 1
  }
  if (main !== lock.commit) {
    // Move the program first, and only then the lock: a refusal leaves both where they were.
    if (lock.carry === "vendored") {
      refuseLocalWork(t)
      copyProgram({ ...t, commit: main })
    } else align({ ...t, commit: main })
    writeRaw(place.data, withCarry({ ...raw, commit: main }, lock.carry))
    io.out(`locked ${locked} → ${short(main)}`)
    return RELAUNCH // the new Naima finishes: it is the one that knows the new format
  }
  if (raw["carry"] !== undefined && withCarry(raw, lock.carry)["carry"] === undefined) writeRaw(place.data, withCarry(raw, lock.carry))
  const from = raw["format"]
  const { all } = await owed(raw, place, opts)
  const steps = migrate(place.data, MIGRATIONS, all.slice(1))
  for (const line of migrated(steps, from, all.slice(1))) io.out(line)
  const tracker = posixRelative(place.root, trackerOf(place.data))
  io.out(`${short(main)} is the lock — commit it as one change: git add ${tracker} && git commit -m "Update Naima to ${short(main)}"`)
  return 0
}

function carryCommand(args: string[], opts: CliOptions, place: Place, lock: Lock, raw: Record<string, unknown>, io: IO): number {
  const [to, ...extra] = parse(args).positionals
  if (!to || extra.length || !CARRY_MODES.includes(to as Carry)) throw new Error(usage("carry"))
  if (to === lock.carry) {
    io.out(`already carried as ${to}`)
    return 0
  }
  carry(targetOf(place, lock, opts), to as Carry)
  writeRaw(place.data, withCarry(raw, to as Carry))
  stage(place.root, join(place.data, DATA_FILE))
  io.out(`carried as ${to} (was ${lock.carry}), staged — commit it as one change: git commit -m "Carry Naima as ${to}"`)
  return 0
}

/** What `naima guide` points at, from the program root: all of it is in naima/, so in every copy. */
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
  const commit = running(opts.programRoot)?.commit
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
        moved = align({ ...targetOf(place, place.lock, opts), acceptSource })
      } catch (e) {
        // update --check only reads the source: it answers whatever program runs it.
        const readOnly = command === "update" && args.includes("--check")
        // A locked commit that cannot be had is what update moves past: whatever program runs it moves the lock to main.
        const moving = command === "update" && !acceptSource
        const code = e instanceof NaimaError ? e.code : null
        if (!((readOnly && code === SOURCE_CHANGED) || (moving && code === COMMIT_UNAVAILABLE))) throw e
      }
      if (moved?.from && moved.from !== place.lock.commit) io.err(`naima: locked commit moved ${short(moved.from)} → ${short(place.lock.commit)}`)
      const target = runtimeOf(place.program)
      if (moved || (target && real(opts.programRoot) !== real(target))) return RELAUNCH
    }
    if (command === "update" || command === "carry") {
      if (!opts.launched) {
        throw new Error(`naima ${command} moves the program, so it runs through the launcher: deno run -A ${TRACKER_DIR}/naima/naima.ts ${command}`)
      }
      return command === "update" ? await update(args, opts, place, place.lock, place.raw, io) : carryCommand(args, opts, place, place.lock, place.raw, io)
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
