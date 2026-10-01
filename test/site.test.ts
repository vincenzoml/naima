// The project site (site/, published by .github/workflows/pages.yml): the
// page's one-liners and agent prompt name the files the site serves, and
// the POSIX installer installs Naima for real — fresh, again, and refusing
// outside a git repository — from a dist built on this disk. The Windows
// installer runs in CI (.github/workflows/install.yml).

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { buildDist, RUNTIME_DIR, selectRuntime } from "../scripts/dist.ts"
import { gitIn as git, removeTemp } from "./core/testing.ts"

const NAIMA = dirname(dirname(fileURLToPath(import.meta.url)))
const SITE = join(NAIMA, "site")
const BASE = "https://vincenzoml.github.io/naima/"
const read = (f: string): string => readFileSync(join(SITE, f), "utf8")
const page = read("index.html")
const prompt = /<code id="prompt">([\s\S]*?)<\/code>/.exec(page)?.[1] ?? ""

test("the site serves what the page points at: the installers, llms.txt, the favicon", () => {
  for (const f of ["index.html", "install.sh", "install.ps1", "llms.txt", "favicon.svg"]) assert.ok(existsSync(join(SITE, f)), `site/${f}`)
  assert.match(page, /<title>Naima<\/title>/)
  assert.match(page, new RegExp(`<code id="sh">curl -fsSL ${BASE}install\\.sh \\| sh</code>`))
  assert.match(page, new RegExp(`<code id="ps">irm ${BASE}install\\.ps1 \\| iex</code>`))
  assert.match(page, /href="favicon\.svg"/)
  const urls = [...page.matchAll(/https:\/\/vincenzoml\.github\.io\/naima\/([\w.-]+)/g)].map((m) => m[1] as string)
  for (const f of urls) assert.ok(existsSync(join(SITE, f)), `the page points at ${BASE}${f}, which site/ does not hold`)
  const llms = read("llms.txt")
  assert.ok(llms.includes(`curl -fsSL ${BASE}install.sh | sh`) && llms.includes(`irm ${BASE}install.ps1 | iex`), "llms.txt gives the same one-liners")
  assert.ok(read("install.sh").includes(`curl -fsSL ${BASE}install.sh | sh`) && read("install.ps1").includes(`irm ${BASE}install.ps1 | iex`))
})

test("the agent prompt is five lines: llms.txt, the one-liner, naima check, the skill", () => {
  const lines = prompt.split("\n")
  assert.equal(lines.length, 5, prompt)
  assert.ok(prompt.includes(`${BASE}llms.txt`))
  assert.match(prompt, /naima-tracker\/naima\/naima\.ts check/)
  assert.match(prompt, /naima-tracker\/naima\/skills\/naima\/SKILL\.md/)
  assert.ok(existsSync(join(NAIMA, RUNTIME_DIR, "skills", "naima", "SKILL.md")), "the skill the prompt names ships")
})

test("the logo is named Naima, and its animation is hidden from assistive technology", () => {
  assert.match(page, /<h1>\s*<span class="sr">Naima<\/span>\s*<span class="mark" aria-hidden="true">/)
  assert.match(page, /<span class="word" aria-hidden="true">/)
  assert.match(page, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(page, /<(?:script|link)[^>]+(?:src|href)="https?:/, "no external script or stylesheet")
})

/** A repository on this disk whose dist branch holds this checkout's runtime files: the installer's source. */
function localSource(base: string): string {
  const dir = join(base, "naima")
  const files = git(NAIMA, "ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0").filter((p) => p && existsSync(join(NAIMA, p)))
  const runtime = new Set(selectRuntime(files).map(([from]) => from))
  for (const f of files.filter((p) => runtime.has(p) || p.startsWith(`${RUNTIME_DIR}/`))) {
    mkdirSync(dirname(join(dir, f)), { recursive: true })
    if (lstatSync(join(NAIMA, f)).isSymbolicLink()) symlinkSync(readlinkSync(join(NAIMA, f)), join(dir, f))
    else copyFileSync(join(NAIMA, f), join(dir, f))
  }
  git(dir, "init", "-q", "-b", "main")
  git(dir, "add", "-A")
  git(dir, "commit", "-q", "-m", "Naima")
  buildDist(dir)
  return dir
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === ".git" ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

test("install.sh installs Naima in a git repository, says so when run again, and refuses outside one", { skip: process.platform === "win32" }, () => {
  const base = mkdtempSync(join(tmpdir(), "naima-site-"))
  try {
    const source = localSource(base)
    const run = (cwd: string) =>
      spawnSync("sh", [join(SITE, "install.sh")], {
        cwd,
        encoding: "utf8",
        env: { ...process.env, NAIMA_SOURCE: source, NAIMA_NO_DENO_INSTALL: "1", GIT_CEILING_DIRECTORIES: base, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t" },
      })
    const project = join(base, "project")
    mkdirSync(project)
    git(project, "init", "-q", "-b", "main")

    const fresh = run(project)
    assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr)
    assert.match(fresh.stdout, /all invariants hold/)
    assert.ok(existsSync(join(project, "naima-tracker", "naima-data", "naima.json")))
    const program = walk(join(project, "naima-tracker", "naima"))
    assert.ok(program.some((f) => f.endsWith("naima.ts")))
    assert.deepEqual(program.filter((f) => f.endsWith(".test.ts")), [], "no test reaches the project")
    assert.deepEqual(program.filter((f) => f.includes(join("naima", "naima-tracker"))), [], "none of Naima's own items reaches the project")
    assert.equal(git(join(project, "naima-tracker", "naima"), "rev-parse", "--abbrev-ref", "HEAD"), "dist")

    const again = run(project)
    assert.equal(again.status, 0, again.stdout + again.stderr)
    assert.match(again.stdout, /already installed/)
    assert.match(again.stdout, /all invariants hold/)

    const outside = join(base, "outside")
    mkdirSync(outside)
    const refused = run(outside)
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /not a git repository/)
    assert.ok(!existsSync(join(outside, "naima-tracker")))
  } finally {
    removeTemp(base)
  }
})
