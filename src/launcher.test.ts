// The launcher's fence, through the real launcher under Deno: the environment
// the program is handed, a path Deno's permission flags cannot express, and
// the host files only `init --write-excludes` may write (docs/guide/install.md#the-permissions).

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { allowedEnv } from "./launcher.ts"
import { gitIn as git, removeTemp } from "./core/testing.ts"

const NAIMA = dirname(dirname(fileURLToPath(import.meta.url)))
const hasDeno = spawnSync("deno", ["--version"]).status === 0
const skip = !hasDeno && "deno is not on PATH"

function launch(cwd: string, args: string[], extraEnv: Record<string, string> = {}) {
  const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: "1", NAIMA_DATA: undefined, NAIMA_LAUNCHED: undefined, ...extraEnv }
  const r = spawnSync("deno", ["run", "-A", join(cwd, "naima-tracker", "naima", "naima.ts"), ...args], { cwd, encoding: "utf8", env })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}

/** A Naima source with a plugin that reports what it can see, and a host at `name` bootstrapped from it. */
function world(name = "project") {
  const base = mkdtempSync(join(tmpdir(), "naima-launcher-"))
  const source = join(base, "naima")
  cpSync(join(NAIMA, "src"), join(source, "src"), { recursive: true })
  cpSync(join(NAIMA, "naima.ts"), join(source, "naima.ts"))
  mkdirSync(join(source, "plugins"))
  writeFileSync(
    join(source, "plugins", "probe.ts"),
    `export default () => ({
  name: "probe",
  says: "reports the environment it is handed",
  commands: [{ name: "probe", says: "probe", usage: "probe", examples: ["probe"], run: (_a: string[], ctx: any) => {
    ctx.out("secret=" + String(Deno.env.get("UNRELATED_SECRET")))
    ctx.out("git=" + String(Deno.env.get("GIT_PROBE")))
    ctx.out("home=" + String(!!Deno.env.get("HOME")))
    return 0
  } }],
})
`,
  )
  git(source, "init", "-q", "-b", "main")
  git(source, "add", "-A")
  git(source, "commit", "-q", "-m", "Naima with a probe")
  const host = join(base, name)
  mkdirSync(host)
  writeFileSync(join(host, "README.md"), "# A project\n")
  git(host, "init", "-q", "-b", "main")
  git(host, "add", "-A")
  git(host, "commit", "-q", "-m", "init")
  git(host, "clone", "-q", "--", source, "naima-tracker/naima")
  return { base, source, host, cleanup: () => removeTemp(base) }
}

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

test("the program is handed only the allow-listed environment: an unrelated secret is not there, git's variables are", { skip }, () => {
  const w = world()
  try {
    assert.equal(launch(w.host, ["init"]).code, 0)
    const file = join(w.host, "naima-tracker", "naima-data", "naima.json")
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), plugins: { probe: { source: "plugins/probe.ts" } } }, null, 2))
    const r = launch(w.host, ["probe"], { UNRELATED_SECRET: "s3cret", GIT_PROBE: "seen" })
    assert.equal(r.code, 0, r.err)
    assert.deepEqual(r.out.split("\n"), ["secret=undefined", "git=seen", "home=true"])
  } finally {
    w.cleanup()
  }
})

test("a project path with a comma is refused in one named line, not with Deno's NotCapable", { skip }, () => {
  const w = world("my,project")
  try {
    const r = launch(w.host, ["check"])
    assert.equal(r.code, 2)
    assert.equal(r.err.split("\n").length, 1, r.err)
    assert.match(r.err, /^naima: the path .*my,project.* holds a comma, which Deno's permission flags cannot express/)
    assert.doesNotMatch(r.err, /NotCapable/)
  } finally {
    w.cleanup()
  }
})

test("init --write-excludes may write the host's deno.json through the launcher; init alone may not touch it", { skip }, () => {
  const w = world()
  try {
    writeFileSync(join(w.host, "deno.json"), "{}\n")
    const printed = launch(w.host, ["init"])
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
