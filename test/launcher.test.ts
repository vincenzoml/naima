// The launcher's fence, through the real launcher under Deno: the environment
// the program is handed, a path Deno's permission flags cannot express, and
// the host files only `init --write-excludes` and `init --write-agent-pointer` may write (docs/guide/install.md#the-permissions).

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { allowedEnv } from "../naima/src/launcher.ts"
import { leftovers, type Running, startGroup, WAIT_MS } from "./core/processes.ts"
import { gitIn as git, productRepo, removeTemp } from "./core/testing.ts"
const hasDeno = spawnSync("deno", ["--version"]).status === 0
const skip = !hasDeno && "deno is not on PATH"

/** The launcher of the project at `cwd`, or `launcher`: the program's own. */
function launch(cwd: string, args: string[], extraEnv: Record<string, string> = {}, launcher = join(cwd, "naima-tracker", "naima", "naima.ts")) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    NO_COLOR: "1",
    NAIMA_DATA: undefined,
    NAIMA_LAUNCHED: undefined,
    ...extraEnv,
  }
  const r = spawnSync("deno", ["run", "-A", launcher, ...args], { cwd, encoding: "utf8", env })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}

const PROBE = `export default () => ({
  name: "probe",
  says: "reports the environment it is handed",
  commands: [{ name: "probe", says: "probe", usage: "probe", examples: ["probe"], run: (_a: string[], ctx: any) => {
    ctx.out("secret=" + String(Deno.env.get("UNRELATED_SECRET")))
    ctx.out("git=" + String(Deno.env.get("GIT_PROBE")))
    ctx.out("home=" + String(!!Deno.env.get("HOME")))
    return 0
  } }, { name: "probe-listen", says: "probe-listen", usage: "probe-listen", examples: ["probe-listen"], run: (_a: string[], ctx: any) => {
    try {
      Deno.listen({ hostname: "127.0.0.1", port: 0 }).close()
      ctx.out("listen=granted")
    } catch (e) {
      ctx.out("listen=" + (e as Error).name)
    }
    return 0
  } }],
})
`

/** The product with a plugin that reports what it can see, and a host at `name` with a git clone of it as its program. */
function world(name = "project") {
  const base = mkdtempSync(join(tmpdir(), "naima-launcher-"))
  const source = productRepo(join(base, "naima"), { extra: { "plugins/probe.ts": PROBE } }).dir
  const host = join(base, name)
  mkdirSync(host)
  writeFileSync(join(host, "README.md"), "# A project\n")
  git(host, "init", "-q", "-b", "main")
  git(host, "add", "-A")
  git(host, "commit", "-q", "-m", "init")
  git(host, "clone", "-q", "--", source, "naima-tracker/naima")
  /** init, as the installer runs it: from the clone. */
  const init = (...args: string[]) => launch(host, ["init", ...args])
  return { base, source, host, init, cleanup: () => removeTemp(base) }
}

/** A test that spawns Naima through the launcher: past Bun's 5 second default under load (bugs/bun-test-ignores-bunfig-toml-s-30). */
const LAUNCHED = 30_000

test("the environment allow-list keeps Naima's, git's, ssh's and the locale's variables, and nothing else", () => {
  const kept = allowedEnv({
    HOME: "/h",
    PATH: "/bin",
    NAIMA_DATA: "d",
    GIT_SSH_COMMAND: "ssh",
    SSH_AUTH_SOCK: "s",
    LC_ALL: "C",
    https_proxy: "p",
    Path: "w",
    AWS_SECRET_ACCESS_KEY: "no",
    GITHUB_TOKEN: "no",
    OPENAI_API_KEY: "no",
  })
  assert.deepEqual(Object.keys(kept).sort(), ["GIT_SSH_COMMAND", "HOME", "LC_ALL", "NAIMA_DATA", "PATH", "Path", "SSH_AUTH_SOCK", "https_proxy"])
})

test("the program is handed only the allow-listed environment: an unrelated secret is not there, git's variables are", { skip, timeout: LAUNCHED }, () => {
  const w = world()
  try {
    assert.equal(w.init().code, 0)
    const file = join(w.host, "naima-tracker", "naima-data", "naima.json")
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), plugins: { probe: { source: "plugins/probe.ts" } } }, null, 2))
    const r = launch(w.host, ["probe"], { UNRELATED_SECRET: "s3cret", GIT_PROBE: "seen" })
    assert.equal(r.code, 0, r.err)
    assert.deepEqual(r.out.split("\n"), ["secret=undefined", "git=seen", "home=true"])
  } finally {
    w.cleanup()
  }
})

test("a project path with a comma is refused in one named line, not with Deno's NotCapable", { skip, timeout: LAUNCHED }, () => {
  const w = world("my,project")
  try {
    const r = w.init()
    assert.equal(r.code, 2)
    assert.equal(r.err.split("\n").length, 1, r.err)
    assert.match(r.err, /^naima: the path .*my,project.* holds a comma, which Deno's permission flags cannot express/)
    assert.doesNotMatch(r.err, /NotCapable/)
  } finally {
    w.cleanup()
  }
})

test("init --write-excludes may write the host's deno.json through the launcher; init alone may not touch it", { skip, timeout: LAUNCHED }, () => {
  const w = world()
  try {
    writeFileSync(join(w.host, "deno.json"), "{}\n")
    const printed = w.init()
    assert.equal(printed.code, 0, printed.err)
    assert.match(printed.out, /exclude from deno\.json/)
    assert.equal(readFileSync(join(w.host, "deno.json"), "utf8"), "{}\n")
    const written = launch(w.host, ["init", "--write-excludes"])
    assert.equal(written.code, 0, written.err)
    assert.deepEqual(JSON.parse(readFileSync(join(w.host, "deno.json"), "utf8")), { exclude: ["naima-tracker/naima/"] })
  } finally {
    w.cleanup()
  }
})

test("init --write-agent-pointer may write the host's AGENTS.md through the launcher; init alone may not touch it", { skip, timeout: LAUNCHED }, () => {
  const w = world()
  try {
    writeFileSync(join(w.host, "AGENTS.md"), "# Working here\n")
    const printed = w.init()
    assert.equal(printed.code, 0, printed.err)
    assert.match(printed.out, /agent pointer missing from AGENTS\.md/)
    assert.equal(readFileSync(join(w.host, "AGENTS.md"), "utf8"), "# Working here\n")
    const written = launch(w.host, ["init", "--write-agent-pointer"])
    assert.equal(written.code, 0, written.err)
    assert.match(readFileSync(join(w.host, "AGENTS.md"), "utf8"), /^Naima is in naima-tracker\/ \(naima\/ the program, naima-data\/ the data\)/m)
  } finally {
    w.cleanup()
  }
})

/** `naima ui --no-open` through the launcher of `w`, handed to `body` once it serves; stopped, group and all, however `body` ends. */
async function withUi(w: ReturnType<typeof world>, body: (ui: Running, url: string) => Promise<void>): Promise<void> {
  const env = { ...process.env, NO_COLOR: "1", NAIMA_DATA: undefined, NAIMA_LAUNCHED: undefined }
  const ui = startGroup("deno", ["run", "-A", join(w.host, "naima-tracker", "naima", "naima.ts"), "ui", "--no-open"], { cwd: w.host, env })
  try {
    const [, url] = await ui.waitFor(/serving (http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+)/)
    await body(ui, url!)
  } finally {
    await ui.stop()
  }
}

const posixOnly = skip || (process.platform === "win32" && "a process group is POSIX")

test("through the launcher, ui may serve on the loopback interface and no other command may listen", { skip: posixOnly, timeout: 120_000 }, async () => {
  const w = world()
  try {
    assert.equal(w.init().code, 0)
    const file = join(w.host, "naima-tracker", "naima-data", "naima.json")
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), plugins: { probe: { source: "plugins/probe.ts" } } }, null, 2))
    const probe = launch(w.host, ["probe-listen"])
    assert.equal(probe.code, 0, probe.err)
    assert.equal(probe.out, "listen=NotCapable")
    await withUi(w, async (ui, url) => {
      // the first screen, rendered under the launcher's grants
      const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(WAIT_MS) })
      assert.equal(r.status, 200)
      assert.match(await r.text(), /aria-labelledby="panel-summary"/)
      assert.equal((await fetch(url.replace(/\?token=.*/, ""), { signal: AbortSignal.timeout(WAIT_MS) })).status, 403)
      // Ctrl-C in a terminal reaches the whole process group: the launcher and the program
      process.kill(-ui.pid, "SIGINT")
      assert.equal(await ui.exited(), 0, ui.err())
    })
    assert.deepEqual(leftovers(w.base), [])
  } finally {
    w.cleanup()
  }
})

test("a ui a test starts is stopped, launcher and program, even when the test fails while it serves", { skip: posixOnly, timeout: 120_000 }, async () => {
  const w = world()
  try {
    assert.equal(w.init().code, 0)
    let seen: string[] = []
    await assert.rejects(
      withUi(w, () => {
        seen = leftovers(w.base)
        throw new Error("a failed assertion")
      }),
      /a failed assertion/,
    )
    assert.ok(seen.length >= 2, `the launcher and the program were running: ${seen.join("; ")}`)
    assert.deepEqual(leftovers(w.base), [])
  } finally {
    w.cleanup()
  }
})
