// A long-lived child process a test starts — `naima ui` above all — that never outlives the test:
// it runs in a process group of its own, every wait on it is bounded, and `stop()`, called from the
// test's `finally`, ends the whole group whatever happened before (bugs/test-runs-leave-naima-ui-processes-running).
// A child left running keeps the test file's process alive through its pipes, and the runner waits on it forever.

import { type ChildProcess, spawn, type SpawnOptions, spawnSync } from "node:child_process"

/** How long a test waits on a child before it fails instead of hanging. */
export const WAIT_MS = 60_000

export interface Running {
  child: ChildProcess
  /** The process group: the child and everything it started. */
  pid: number
  out(): string
  err(): string
  /** The first match of `pattern` on stdout; rejects once the child exits without it, or after `ms`. */
  waitFor(pattern: RegExp, ms?: number): Promise<RegExpMatchArray>
  /** The child's exit code; rejects after `ms`. */
  exited(ms?: number): Promise<number | null>
  /** End the whole group: SIGTERM, then SIGKILL to what is left; resolves once nothing of it runs. */
  stop(): Promise<void>
}

/** Whether any process of group `pid` still runs. */
export function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"
  }
}

const signal = (pid: number, sig: NodeJS.Signals): void => {
  try {
    process.kill(-pid, sig)
  } catch { /* the group is gone */ }
}

const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

/** Rejects with `what` after `ms`, unless `p` settles first; the timer never keeps the process alive. */
function bounded<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, fail) => (timer = setTimeout(() => fail(new Error(`${what}: nothing after ${ms} ms`)), ms)))
  return Promise.race([p, late]).finally(() => clearTimeout(timer))
}

/** Start `cmd` in a process group of its own (POSIX), collecting its output. */
export function startGroup(cmd: string, args: string[], opts: SpawnOptions = {}): Running {
  const child = spawn(cmd, args, { ...opts, detached: true, stdio: ["ignore", "pipe", "pipe"] })
  let out = ""
  let err = ""
  child.stdout!.on("data", (b) => (out += String(b)))
  child.stderr!.on("data", (b) => (err += String(b)))
  const exit = new Promise<number | null>((done) => {
    child.once("exit", (code) => done(code))
    child.once("error", () => done(null))
  })
  const pid = child.pid!
  return {
    child,
    pid,
    out: () => out,
    err: () => err,
    waitFor: (pattern, ms = WAIT_MS) =>
      bounded(
        new Promise<RegExpMatchArray>((done, fail) => {
          const look = () => {
            const m = out.match(pattern)
            if (m) done(m)
          }
          child.stdout!.on("data", look)
          look()
          void exit.then((code) => fail(new Error(`${cmd} exited ${code} before printing ${pattern}: ${err}`)))
        }),
        ms,
        `waiting for ${pattern} from ${cmd}`,
      ),
    exited: (ms = WAIT_MS) => bounded(exit, ms, `waiting for ${cmd} to exit`),
    stop: async () => {
      for (const [sig, ms] of [["SIGTERM", 3000], ["SIGKILL", 3000]] as const) {
        if (!groupAlive(pid)) break
        signal(pid, sig)
        for (let waited = 0; waited < ms && groupAlive(pid); waited += 25) await pause(25)
      }
      child.stdout?.destroy()
      child.stderr?.destroy()
      if (groupAlive(pid)) throw new Error(`process group ${pid} (${cmd}) survived SIGKILL`)
    },
  }
}

/** The processes whose command line holds `marker` — a test's temporary directory — as `pid command` lines. */
export function leftovers(marker: string): string[] {
  const r = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" })
  return r.stdout.split("\n").map((l) => l.trim()).filter((l) => l.includes(marker) && !/^\d+\s+ps\b/.test(l))
}
