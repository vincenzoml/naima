// Long work: a command that outlasts a session is started detached by
// `naima run`, with a time budget and, when it writes stores, a disk budget on
// what it declares it creates; `naima wait` blocks on it by its record, never
// by a process pattern, bounded by a timeout; `naima run list` shows every run
// against its budgets; `naima run clean` removes what it declared. A run on
// another machine is a run of that host's own Naima, over ssh. A rule shipped
// here makes these mandatory for agents, and the check `wait-loops` finds the
// hand-written waits it forbids. Specification:
// specs/long-work-naima-run-wait-run-list in Naima's own tracker; for people,
// docs/guide/long-work.md.

import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, parse as parsePath, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import {
  bool,
  type Check,
  type Command,
  type Context,
  CONTRACT,
  EXIT,
  type Finding,
  gitOrNull,
  gitPath,
  NaimaError,
  parse,
  type Plugin,
  positiveInt,
  str,
  strs,
  TRACKER_DIR,
  usageError,
} from "../../core/api.ts"
import { ALLOW, findWaits, SCRIPT } from "./loops.ts"
import {
  DEFAULTS,
  ensureRunsDir,
  NAME,
  parseDuration,
  parseSize,
  readSpec,
  recordDirs,
  RUN_FILE,
  runsDir,
  type RunSpec,
  type RunView,
  showDuration,
  showSize,
  STOP_FILE,
  SUBCOMMANDS,
  trackerFolder,
  view,
  writeJsonAtomic,
} from "./records.ts"
import { type Host, readHosts, sshArgs } from "./remote.ts"

const SUPERVISOR = fileURLToPath(new URL("./supervisor.ts", import.meta.url))
const isDeno = typeof (globalThis as { Deno?: unknown }).Deno !== "undefined"

/** The runtime's arguments that run the supervisor in `mode`, granted write access to `write` alone under Deno. */
function supervisorArgs(mode: "supervise" | "clean", dir: string, write: string[]): string[] {
  const script = [SUPERVISOR, mode, dir]
  if (!isDeno) return script
  return ["run", "--no-prompt", "--no-config", "--no-lock", "--allow-read", `--allow-write=${write.join(",")}`, "--allow-run", "--allow-env", ...script]
}

const delay = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))
const refuse = (msg: string): NaimaError => new NaimaError(msg)

const tracker = (ctx: Context): string => trackerFolder(ctx.trackerRoot, TRACKER_DIR)
const recordOf = (ctx: Context, name: string): string => join(runsDir(tracker(ctx)), name)

/** A path with its symlinks resolved as far as it exists: what git and the repository root are compared in. */
function real(path: string): string {
  let head = resolve(path)
  const rest: string[] = []
  while (!existsSync(head) && dirname(head) !== head) {
    rest.unshift(head.slice(dirname(head).length + 1))
    head = dirname(head)
  }
  try {
    head = realpathSync(head)
  } catch { /* left as it is */ }
  return join(head, ...rest)
}

/** Why `path` may not be declared as created by a run, or null: §3 (naima run, 1) of the specification. */
export function unsafePath(root: string, path: string): string | null {
  const p = real(path)
  const top = real(root)
  if (p === parsePath(p).root) return "is the filesystem root"
  const home = process.env["HOME"] ?? process.env["USERPROFILE"]
  if (home && real(home) === p) return "is the home directory"
  if (p === top || top.startsWith(p.endsWith(sep) ? p : p + sep)) return "is the repository root or a directory above it"
  if (isDeno && p.includes(",")) return "holds a comma, which Deno's permission flags cannot express"
  const inside = relative(top, p)
  if (!inside.startsWith("..") && !isAbsolute(inside)) {
    const tracked = (gitOrNull(top, "ls-files", "-z", "--", gitPath(inside)) ?? "").split("\0").filter(Boolean)
    if (tracked.length) return `is or holds a file git tracks (${tracked[0]})`
  }
  return null
}

function hostOf(hosts: Map<string, Host>, name: string): Host {
  const h = hosts.get(name)
  if (!h) {
    throw refuse(
      `no host "${name}" — declare it in naima.json: plugins.long-work.options.hosts.${name} = { "ssh": "<destination>", "dir": "<project on the host>" }${
        hosts.size ? `; declared: ${[...hosts.keys()].join(", ")}` : ""
      }`,
    )
  }
  return h
}

/** Ask the host's Naima `args`; its answer, or why there is none. */
function onHost(host: Host, args: string[], timeoutMs = 120_000): { ok: boolean; out: string; err: string; code: number } {
  const r = spawnSync("ssh", sshArgs(host, args), { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] })
  const err = r.error ? `ssh: ${r.error.message}` : String(r.stderr ?? "").trim()
  return { ok: r.status === 0, out: String(r.stdout ?? ""), err, code: r.status ?? 1 }
}

/** A remote run, as its host reports it; `unknown` with the reason when the host cannot be asked. */
function remoteView(host: Host, name: string, tail: number): RunView {
  const r = onHost(host, ["run", "status", name, "--json", "--tail", String(Math.max(1, tail))])
  if (r.ok) {
    try {
      const v = JSON.parse(r.out) as RunView
      return { ...v, host: host.name, ...(tail ? {} : { tail: [] }) }
    } catch { /* not an answer */ }
  }
  const why = r.err.split("\n").filter(Boolean).pop() ?? `exit ${r.code}`
  return { name, host: host.name, state: "unknown", over: false, started: "", elapsedMs: 0, budgetTimeMs: 0, log: "", error: `${host.ssh}: ${why}` }
}

/** The run named `name`, as every reader reports it. */
function runView(ctx: Context, hosts: Map<string, Host>, name: string, tail: number): RunView {
  const dir = recordOf(ctx, name)
  const spec = readSpec(dir)
  if (!existsSync(dir)) throw refuse(`no run "${name}" here — naima run list shows the runs of this worktree`)
  if (spec?.host) return remoteView(hostOf(hosts, spec.host), name, tail)
  return view(dir, Date.now(), tail)
}

const ofBudget = (v: RunView): string => `${showDuration(v.elapsedMs)} of ${showDuration(v.budgetTimeMs)}`
const disk = (v: RunView): string | null =>
  v.sizeBytes === undefined && v.budgetDiskBytes === undefined
    ? null
    : `${showSize(v.sizeBytes ?? 0)}${v.budgetDiskBytes !== undefined ? ` of ${showSize(v.budgetDiskBytes)}` : ""}${
      v.peakBytes !== undefined && v.peakBytes !== v.sizeBytes ? ` (peak ${showSize(v.peakBytes)})` : ""
    }`

/** One run in full, as `wait` and `run status` print it. */
export function describe(v: RunView): string[] {
  const how = v.state === "succeeded" || v.state === "failed"
    ? v.reason === "start-failed" ? `could not start${v.error ? `: ${v.error}` : ""}` : v.signal ? `signal ${v.signal}` : `exit ${v.exitCode}`
    : v.state === "killed"
    ? `over its ${v.reason === "budget-disk" ? "disk" : "time"} budget`
    : v.state === "lost"
    ? "its supervisor is gone (killed, or the machine restarted) and no end was recorded"
    : v.state === "unknown"
    ? `cannot be asked: ${v.error ?? "no answer"}`
    : null
  const out = [`run ${v.name}${v.host ? ` on ${v.host}` : ""}: ${v.over || v.state === "unknown" ? v.state : `still ${v.state}`}${how ? ` — ${how}` : ""}`]
  if (v.state !== "unknown") out.push(`  time: ${ofBudget(v)}`)
  const d = disk(v)
  if (d) out.push(`  disk: ${d}`)
  if (v.pid !== undefined) out.push(`  pid: ${v.pid}`)
  if (v.progress) out.push(`  progress: ${JSON.stringify(v.progress.line)} (${showDuration(v.progress.ageMs)} ago)`)
  if (v.changedTracked?.length) out.push(`  tracked files changed, which a guarded run must not: ${v.changedTracked.join(", ")}`)
  if (v.log) out.push(`  log: ${v.log}`)
  if (v.tail?.length) out.push(`  last ${v.tail.length} line${v.tail.length > 1 ? "s" : ""} of the log:`, ...v.tail.map((l) => `    ${l}`))
  return out
}

/** One run in a line, as `run list` prints it: stale and lost runs in capitals. */
export function listLine(v: RunView): string {
  const state = v.state === "stale" || v.state === "lost" ? v.state.toUpperCase() : v.state
  const parts = [v.name, state, v.state === "unknown" ? v.error ?? "" : ofBudget(v)]
  const d = disk(v)
  if (d) parts.push(`disk ${d}`)
  if (v.host) parts.push(`on ${v.host}`)
  if (v.progress) parts.push(`progress ${JSON.stringify(v.progress.line)} ${showDuration(v.progress.ageMs)} ago`)
  return parts.join("  ")
}

const duration = (raw: string | undefined, fallback: number | null, what: string): number | null => {
  if (raw === undefined) return fallback
  const ms = parseDuration(raw)
  if (ms === null) throw refuse(`${what}: "${raw}" is not a duration — <n>s, <n>m, <n>h or <n>d`)
  return ms
}

/** `naima run <name> ...`: start a run, here or on a host. */
async function start(ctx: Context, hosts: Map<string, Host>, cmd: Command, args: string[]): Promise<number> {
  const at = args.indexOf("--")
  if (at < 0 || at === args.length - 1) throw refuse(`naima run: give the command after "--" — usage: naima ${cmd.usage.split(" | ")[0]}`)
  const command = args.slice(at + 1)
  const p = parse(args.slice(0, at), {
    "budget-time": { type: "string" },
    "budget-disk": { type: "string" },
    creates: { type: "string", multiple: true },
    every: { type: "string" },
    stale: { type: "string" },
    host: { type: "string" },
    "guard-tracked": { type: "boolean" },
  })
  const [name, ...extra] = p.positionals
  if (!name || extra.length) throw usageError(cmd)
  if (!NAME.test(name) || (SUBCOMMANDS as readonly string[]).includes(name)) {
    throw refuse(`naima run: "${name}" is not a run name — lowercase letters, digits, ".", "_" and "-", at most 64, and none of ${SUBCOMMANDS.join(", ")}`)
  }
  const dir = recordOf(ctx, name)
  if (existsSync(dir)) {
    throw refuse(`naima run: a run "${name}" is already recorded — naima run status ${name}; naima run clean ${name} before reusing the name`)
  }
  const budgetTime = duration(str(p, "budget-time"), null, "--budget-time")
  if (budgetTime === null) throw refuse("naima run: every run has a time budget — add --budget-time <duration>, such as --budget-time 2h")
  const rawDisk = str(p, "budget-disk")
  const budgetDisk = rawDisk === undefined ? undefined : parseSize(rawDisk)
  if (budgetDisk === null) throw refuse(`--budget-disk: "${rawDisk}" is not a size — <n>, or <n>K, <n>M, <n>G, <n>T`)
  const creates = strs(p, "creates")
  if (budgetDisk !== undefined && !creates.length) throw refuse("naima run: --budget-disk measures what the run creates — declare it with --creates <path>")
  const every = duration(str(p, "every"), DEFAULTS.everyMs, "--every")!
  const stale = duration(str(p, "stale"), DEFAULTS.staleMs, "--stale")!
  const hostName = str(p, "host")
  if (hostName !== undefined) return startRemote(ctx, hostOf(hosts, hostName), name, args.slice(0, at), command, budgetTime, every, stale, creates)
  const cwd = process.cwd()
  const absolute = creates.map((c) => resolve(cwd, c))
  for (const path of absolute) {
    const why = unsafePath(ctx.root, path)
    if (why) throw refuse(`naima run: --creates ${path} ${why} — a run declares only what it creates, and naima run clean removes it`)
  }
  ensureRunsDir(tracker(ctx))
  const spec: RunSpec = {
    name,
    command,
    shell: command.length === 1,
    cwd,
    budgetTimeMs: budgetTime,
    ...(budgetDisk !== undefined ? { budgetDiskBytes: budgetDisk } : {}),
    creates: absolute,
    everyMs: every,
    staleMs: stale,
    guardTracked: bool(p, "guard-tracked"),
    started: new Date().toISOString(),
  }
  mkdirSync(dir)
  writeJsonAtomic(join(dir, RUN_FILE), spec)
  const child = spawn(process.execPath, supervisorArgs("supervise", dir, [dir]), { cwd, detached: true, stdio: "ignore", windowsHide: true })
  child.unref()
  const until = Date.now() + DEFAULTS.startMs
  let v = view(dir, Date.now())
  while (v.state === "starting" && Date.now() < until) {
    await delay(50)
    v = view(dir, Date.now())
  }
  if (v.reason === "start-failed" || (v.over && v.pid === undefined)) {
    for (const l of describe(view(dir, Date.now(), DEFAULTS.tail))) ctx.out(l)
    return EXIT.FAILED
  }
  ctx.out(
    `run ${name}: started${v.pid !== undefined ? `, pid ${v.pid}` : ""}, time budget ${showDuration(budgetTime)}${
      budgetDisk !== undefined ? `, disk budget ${showSize(budgetDisk)}` : ""
    }`,
  )
  ctx.out(`  log: ${join(dir, "log")}`)
  ctx.out(`  progress (the command writes a line to $NAIMA_RUN_PROGRESS): ${join(dir, "progress")}`)
  ctx.out(`  wait: naima wait ${name} --timeout 10m · watch: naima run list · end: naima run stop ${name} · then: naima run clean ${name}`)
  return EXIT.OK
}

/** `naima run --host`: the host's own Naima starts the run, always guarded; here, only the record naming the host. */
function startRemote(
  ctx: Context,
  host: Host,
  name: string,
  given: string[],
  command: string[],
  budgetTime: number,
  every: number,
  stale: number,
  creates: string[],
): number {
  const forwarded: string[] = []
  for (let i = 0; i < given.length; i++) {
    const a = given[i]!
    if (a === "--host") i++
    else if (a.startsWith("--host=")) continue
    else forwarded.push(a)
  }
  if (!forwarded.includes("--guard-tracked")) forwarded.push("--guard-tracked")
  const r = onHost(host, ["run", ...forwarded, "--", ...command])
  for (const l of r.out.split("\n").filter(Boolean)) ctx.out(`${host.name}: ${l}`)
  if (!r.ok) {
    for (const l of r.err.split("\n").filter(Boolean)) ctx.err(`${host.name}: ${l}`)
    const why = r.err.split("\n").filter(Boolean).pop() ?? ""
    throw refuse(
      `naima run: ${host.name} (${host.ssh}) did not start the run (exit ${r.code}${
        why ? `: ${why}` : ""
      }) — its own Naima must have the long-work plugin; nothing recorded here`,
    )
  }
  ensureRunsDir(tracker(ctx))
  const dir = recordOf(ctx, name)
  const spec: RunSpec = {
    name,
    command,
    shell: command.length === 1,
    cwd: host.dir,
    budgetTimeMs: budgetTime,
    creates,
    everyMs: every,
    staleMs: stale,
    guardTracked: true,
    started: new Date().toISOString(),
    host: host.name,
  }
  mkdirSync(dir, { recursive: true })
  writeJsonAtomic(join(dir, RUN_FILE), spec)
  ctx.out(`  wait: naima wait ${name} --timeout 10m (asks ${host.name} every 30s)`)
  return EXIT.OK
}

/** `naima run list`: every run, newest first; a host is asked once for all of its runs. */
function list(ctx: Context, hosts: Map<string, Host>, json: boolean): number {
  const now = Date.now()
  const answers = new Map<string, Map<string, RunView>>()
  const views = recordDirs(tracker(ctx)).map((dir): RunView => {
    const spec = readSpec(dir)
    if (!spec?.host) return view(dir, now)
    const host = hosts.get(spec.host)
    if (!host) return { ...view(dir, now), host: spec.host, state: "unknown", over: false, error: `host "${spec.host}" is no longer declared` }
    if (!answers.has(host.name)) {
      const r = onHost(host, ["run", "list", "--json"])
      const byName = new Map<string, RunView>()
      try {
        for (const v of JSON.parse(r.out) as RunView[]) byName.set(v.name, v)
      } catch { /* the host could not be asked */ }
      answers.set(host.name, byName)
    }
    const v = answers.get(host.name)!.get(spec.name)
    return v ? { ...v, host: host.name } : {
      name: spec.name,
      host: host.name,
      state: "unknown",
      over: false,
      started: spec.started,
      elapsedMs: 0,
      budgetTimeMs: spec.budgetTimeMs,
      log: "",
      error: `${host.ssh} did not report it`,
    }
  })
  if (json) ctx.out(JSON.stringify(views, null, 2))
  else if (!views.length) ctx.out("no runs — naima run <name> --budget-time <duration> -- <command> starts one")
  else for (const v of views) ctx.out(listLine(v))
  return EXIT.OK
}

/** `naima run stop <name>`: the supervisor is asked to end the run, and does at its next check. */
function stop(ctx: Context, hosts: Map<string, Host>, name: string): number {
  const dir = recordOf(ctx, name)
  const spec = readSpec(dir)
  if (!existsSync(dir)) throw refuse(`no run "${name}" here — naima run list shows the runs of this worktree`)
  if (spec?.host) return forward(ctx, hostOf(hosts, spec.host), ["run", "stop", name])
  const v = view(dir, Date.now())
  if (v.state === "lost") {
    ctx.out(`run ${name}: lost — its supervisor is gone, so nothing of it is supervised to stop; naima run clean ${name}`)
    return EXIT.OK
  }
  if (v.over) throw refuse(`run ${name} has already ended (${v.state}) — naima run clean ${name}`)
  writeFileSync(join(dir, STOP_FILE), new Date().toISOString() + "\n")
  ctx.out(
    `run ${name}: asked to stop — its supervisor ends it within ${showDuration(spec?.everyMs ?? DEFAULTS.everyMs)}; naima wait ${name} reports it stopped`,
  )
  return EXIT.OK
}

function forward(ctx: Context, host: Host, args: string[]): number {
  const r = onHost(host, args)
  for (const l of r.out.split("\n").filter(Boolean)) ctx.out(`${host.name}: ${l}`)
  for (const l of r.err.split("\n").filter(Boolean)) ctx.err(`${host.name}: ${l}`)
  return r.code
}

/** `naima run clean <name>`: what the run declared it creates, then its record; never while it runs. */
function cleanRun(ctx: Context, hosts: Map<string, Host>, name: string): number {
  const dir = recordOf(ctx, name)
  const spec = readSpec(dir)
  if (!existsSync(dir)) throw refuse(`no run "${name}" here — naima run list shows the runs of this worktree`)
  if (spec?.host) {
    const code = forward(ctx, hostOf(hosts, spec.host), ["run", "clean", name])
    if (code !== 0) return code
    rmSync(dir, { recursive: true, force: true })
    ctx.out(`run ${name}: its record here removed`)
    return EXIT.OK
  }
  const v = view(dir, Date.now())
  if (!v.over) throw refuse(`run ${name} is ${v.state} — naima run stop ${name}, then naima wait ${name}, then clean it`)
  const creates = spec?.creates ?? []
  for (const path of creates) {
    const why = unsafePath(ctx.root, path)
    if (why) throw refuse(`naima run clean: ${path} ${why} — nothing removed`)
  }
  const present = creates.filter((c) => existsSync(c))
  const r = spawnSync(process.execPath, supervisorArgs("clean", dir, [dir, ...present]), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  if (r.status !== 0) throw refuse(`naima run clean: removing failed — ${String(r.stderr ?? r.error?.message ?? "").trim()}`)
  ctx.out(
    `run ${name}: removed ${present.length ? present.join(", ") + " and " : ""}its record${
      creates.length > present.length ? ` (${creates.length - present.length} declared path${creates.length - present.length > 1 ? "s" : ""} already gone)` : ""
    }`,
  )
  return EXIT.OK
}

/** `naima wait <name>`: block until the run is over or the timeout passes, then report it. */
async function waitFor(ctx: Context, hosts: Map<string, Host>, cmd: Command, args: string[]): Promise<number> {
  const p = parse(args, { timeout: { type: "string" }, every: { type: "string" }, tail: { type: "string" }, json: { type: "boolean" } })
  const [name, ...extra] = p.positionals
  if (!name || extra.length) throw usageError(cmd)
  const timeout = duration(str(p, "timeout"), DEFAULTS.timeoutMs, "--timeout")!
  const tail = positiveInt(str(p, "tail"), DEFAULTS.tail, "--tail")
  const dir = recordOf(ctx, name)
  if (!existsSync(dir)) throw refuse(`no run "${name}" here — naima run list shows the runs of this worktree`)
  const remote = !!readSpec(dir)?.host
  const every = duration(str(p, "every"), remote ? DEFAULTS.remoteEveryMs : DEFAULTS.waitEveryMs, "--every")!
  const until = Date.now() + timeout
  let v = runView(ctx, hosts, name, 0)
  while (!v.over && Date.now() + every <= until) {
    await delay(every)
    v = runView(ctx, hosts, name, 0)
  }
  if (!v.over && Date.now() < until) {
    await delay(Math.max(0, until - Date.now()))
    v = runView(ctx, hosts, name, 0)
  }
  v = runView(ctx, hosts, name, tail)
  if (bool(p, "json")) ctx.out(JSON.stringify(v, null, 2))
  else {
    for (const l of describe(v)) ctx.out(l)
    if (!v.over) {
      ctx.out(
        `naima wait: ${name} is still running after ${showDuration(timeout)} — waiting again is a decision: naima wait ${name}, or naima run stop ${name}`,
      )
    }
  }
  return v.state === "succeeded" ? EXIT.OK : EXIT.FAILED
}

const runCommand = (hosts: Map<string, Host>): Command => ({
  name: "run",
  says:
    "start a long command detached — locally, or on a declared host through its own Naima — with a log, a progress file, a time budget and, on what it declares it creates, a disk budget, ending itself when one runs out; list the runs against their budgets, show one, stop one, or remove what one created",
  enforces:
    "every run has a time budget, and is ended, its whole process group with it, when it runs out or its declared paths outgrow the disk budget; a declared path is never the root, the home directory, the repository or above it, nor holds a tracked file; a run is never cleaned while it runs; a remote run is always guarded, failing when it changes a tracked file",
  usage:
    "run <name> --budget-time <duration> [--budget-disk <size>] [--creates <path>]... [--every <duration>] [--stale <duration>] [--host <host>] [--guard-tracked] -- <command> [<arg>...] | run list [--json] | run status <name> [--tail <n>] [--json] | run stop <name> | run clean <name>",
  options: [
    { name: "--budget-time", says: "how long the run may last, <n>s|m|h|d: past it, it is ended; required" },
    { name: "--budget-disk", says: "how large what it declares it creates may grow, <n>[K|M|G|T]: past it, it is ended; needs --creates" },
    { name: "--creates", says: "a path the run creates (a store, a temporary directory), measured for --budget-disk and removed by run clean; repeatable" },
    { name: "--every", says: "how often the supervisor checks the budgets and a stop request and writes its heartbeat (default 10s)" },
    { name: "--stale", says: "how long with no change to the log or the progress file before the run is reported stale (default 15m)" },
    { name: "--host", says: "run it on this host, declared in the plugin's hosts option, through the host's own Naima over ssh" },
    { name: "--guard-tracked", says: "fail the run if a tracked file changes while it runs; always on for a remote run" },
    { name: "--tail", says: "how many of the log's last lines to print (default 20)" },
    { name: "--json", says: "print the run, or every run, as JSON" },
  ],
  examples: [
    "run bench --budget-time 2h --budget-disk 20G --creates /tmp/bench-stores -- 'deno task bench > results.csv'",
    "run models --budget-time 30m -- mcrl2 --all",
    "run bench --host lab --budget-time 6h -- 'deno task bench'",
    "run list",
    "run status bench --tail 50",
    "run stop bench",
    "run clean bench",
  ],
  run(args, ctx) {
    const [sub, ...rest] = args
    if (sub === "list") {
      const p = parse(rest, { json: { type: "boolean" } })
      if (p.positionals.length) throw usageError(this)
      return list(ctx, hosts, bool(p, "json"))
    }
    if (sub === "status") {
      const p = parse(rest, { json: { type: "boolean" }, tail: { type: "string" } })
      const [name, ...extra] = p.positionals
      if (!name || extra.length) throw usageError(this)
      const v = runView(ctx, hosts, name, positiveInt(str(p, "tail"), DEFAULTS.tail, "--tail"))
      if (bool(p, "json")) ctx.out(JSON.stringify(v, null, 2))
      else for (const l of describe(v)) ctx.out(l)
      return EXIT.OK
    }
    if (sub === "stop" || sub === "clean") {
      const [name, ...extra] = rest
      if (!name || extra.length) throw usageError(this)
      return sub === "stop" ? stop(ctx, hosts, name) : cleanRun(ctx, hosts, name)
    }
    return start(ctx, hosts, this, args)
  },
})

const waitCommand = (hosts: Map<string, Host>): Command => ({
  name: "wait",
  says:
    "block until a run started by naima run ends, or the timeout passes, then print its state, exit status, budgets, last progress line and the log's tail: found by its record, never by a process pattern",
  enforces:
    "a wait is always bounded: it ends at its --timeout (default 10m) and says the run is still running, exiting 1, so waiting again is a decision; it exits 0 only for a run that succeeded",
  usage: "wait <name> [--timeout <duration>] [--every <duration>] [--tail <n>] [--json]",
  options: [
    { name: "--timeout", says: "how long to wait at most, <n>s|m|h|d (default 10m)" },
    { name: "--every", says: "how often to look (default 1s; for a remote run 30s, one ssh call each)" },
    { name: "--tail", says: "how many of the log's last lines to print (default 20)" },
    { name: "--json", says: "print the run as JSON" },
  ],
  examples: ["wait bench", "wait bench --timeout 9m --tail 50", "wait models --json"],
  run(args, ctx) {
    return waitFor(ctx, hosts, this, args)
  },
})

/** The rule this plugin ships, active for agents wherever it is loaded (specification §5). */
export const LONG_WORK_RULE = {
  name: "long-work-through-naima-run",
  title: "Long work goes through naima run and naima wait; no hand-written wait loop",
  audience: "agents",
  strength: "must",
  text:
    "A command expected to outlast a few minutes, or one run on another machine, is started with `naima run <name> --budget-time <duration> -- <command>` — with `--budget-disk` and `--creates` when it writes stores or temporary data, `--host` when it runs elsewhere — waited on with `naima wait <name> --timeout <duration>`, watched with `naima run list`, and cleaned with `naima run clean <name>`. A hand-written wait loop (`while` or `until` with `sleep`) and any process lookup by pattern (`pgrep -f`, `pkill -f`) are forbidden, in a session and in a committed script.",
  why:
    "thirteen hand-written wait loops, each matching its own command line through `pgrep -f`, ran for up to 10.5 hours and were shown to the owner as work in progress; others kept polling a remote run that had hung; a third agent filled a remote disk with stores it never cleaned. A run with a budget ends itself, a wait by record ends when the run does, and what a run declares it creates is removed by one command.",
  ack: "Long work mode on",
  enforcedBy: "wait-loops",
}

const waitLoops: Check = {
  name: "wait-loops",
  says:
    "no tracked shell script holds a hand-written wait — a while/until loop that sleeps, or pgrep -f/pkill -f — and a session note that does is noted; a line marked naima: allow-wait-loop, or the line after it, is exempt",
  run(ctx) {
    const out: Finding[] = []
    const advice = `— long work goes through naima run and naima wait (rule long-work/${LONG_WORK_RULE.name}); or mark the line \`${ALLOW} <reason>\``
    const tracked = (gitOrNull(ctx.root, "ls-files", "-z") ?? "").split("\0").filter((f) => SCRIPT.test(f))
    for (const f of tracked) {
      let text: string
      try {
        text = readFileSync(join(ctx.root, f), "utf8")
      } catch {
        continue
      }
      for (const w of findWaits(text)) out.push({ level: "problem", message: `${f}:${w.line}: a hand-written wait (${w.what}): ${w.text} ${advice}` })
    }
    const notes = join(ctx.trackerRoot, "passes")
    if (existsSync(notes)) {
      for (const f of readdirSync(notes).filter((n) => n.endsWith(".md")).sort()) {
        const text = readFileSync(join(notes, f), "utf8")
        for (const w of findWaits(text)) {
          out.push({
            level: "note",
            message: `${ctx.trackerDir}/passes/${f}:${w.line}: a session note records a hand-written wait (${w.what}) ${advice.replace(/; or mark.*/, "")}`,
          })
        }
      }
    }
    return out
  },
}

export default function longWork(options: Record<string, unknown> = {}): Plugin {
  const hosts = readHosts(options)
  return {
    name: "long-work",
    contract: CONTRACT,
    says:
      "long work, run and waited on by Naima: naima run starts a command detached, with budgets, locally or on a host; naima wait blocks on it by its record; naima run list, status, stop and clean; a shipped rule makes them mandatory for agents",
    about:
      "An agent left to wait for a long command improvises — a `sleep` loop, a `pgrep -f` that matches itself — and the wait outlives the work by hours. " +
      "`naima run <name> --budget-time <d> -- <command>` starts the command detached, under a supervisor of its own, with a log, a progress file (`$NAIMA_RUN_PROGRESS`) and a record in the tracker folder's `.runs/`, which ignores itself. " +
      "The supervisor writes a heartbeat every `--every`, and ends the command's whole process group when the time budget runs out, when what it declares with `--creates` outgrows `--budget-disk`, or when `naima run stop` asks. " +
      "`naima wait <name>` reads the record — never the process table — until the run ends or `--timeout` passes, then prints the state, exit status and the log's tail. " +
      "`naima run list` shows every run against its budgets, marking stale runs (no output for `--stale`) and lost ones (no heartbeat); `naima run clean` removes what a run declared, never a tracked file, never while it runs. " +
      "A host declared in the `hosts` option is reached over ssh, and a run there is a run of the host's own Naima, always `--guard-tracked`: a tracked file it changes fails it. " +
      "The plugin ships the rule that makes these mandatory for agents, enforced by the check `wait-loops`.",
    options: [
      {
        name: "hosts",
        default: "{}",
        says:
          'the machines a run may go to: name → { "ssh": the destination ssh is given, "dir": the project\'s checkout there, "naima": the command that runs its Naima from dir (default `deno run -A naima-tracker/naima/naima.ts`) }',
      },
    ],
    commands: [runCommand(hosts), waitCommand(hosts)],
    checks: [waitLoops],
    contributes: { rules: [LONG_WORK_RULE] },
    optional: ["rules"],
  }
}
