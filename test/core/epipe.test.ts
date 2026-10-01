// bugs/piping-command-s-output-into-head-crashes: a reader that closes the
// pipe early (`naima list | head -1`) used to end the CLI with an uncaught
// EPIPE stack trace. It should end quietly instead: exit 0, no error on stderr.
// Reproduced as a real subprocess, under each runtime the CLI actually runs on.

import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const CLI = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "naima", "src", "cli.ts")

const hasDeno = spawnSync("deno", ["--version"]).status === 0
const hasBun = spawnSync("bun", ["--version"]).status === 0
const hasNode = spawnSync("node", ["--version"]).status === 0

/** Runs the CLI under `cmd`, closes its stdout after the first line, and reports how the process ended. */
function runAndCutPipe(cmd: string, args: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    let err = ""
    child.stderr.on("data", (d) => (err += String(d)))
    child.stdout.once("data", () => child.stdout.destroy()) // the reading end hangs up, as `head -1` does
    child.on("close", (code, signal) => resolve({ code, signal, err }))
  })
}

const cases: [string, boolean, string[]][] = [
  ["deno", hasDeno, ["run", "-A", CLI, "list"]],
  ["node", hasNode, [CLI, "list"]],
  ["bun", hasBun, [CLI, "list"]],
]

for (const [runtime, available, args] of cases) {
  test(`piping naima's output into a reader that closes early ends quietly, on ${runtime}`, { skip: !available && `${runtime} is not on PATH` }, async () => {
    const r = await runAndCutPipe(runtime, args)
    assert.equal(r.code, 0, `exit code — stderr: ${r.err}`)
    assert.equal(r.err, "", "nothing on stderr: no EPIPE stack trace")
  })
}
