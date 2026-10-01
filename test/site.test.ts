// The project site (site/, built by scripts/site.ts and published by
// .github/workflows/pages.yml): the page's one-liners and agent prompt name
// the files the site serves, and the README gives the same install; and the POSIX installer installs Naima for real — fresh, again, and
// refusing outside a git repository — from a dist built on this disk. The
// Windows installer runs in CI (.github/workflows/install.yml).

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { buildDist, RUNTIME_DIR, selectRuntime } from "../scripts/dist.ts"
import { buildSite, tokensOf } from "../scripts/site.ts"
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

const AGENT_LINE =
  "This repository tracks its work with Naima: at the start of every session read naima-tracker/naima/skills/naima/SKILL.md and `naima rules --audience agents`, and work by them."

test("the agent prompt is one line naming the repository, whose README, llms.txt and the page all give the steps", () => {
  assert.equal(prompt, "Please install https://github.com/vincenzoml/naima in this repository.")
  assert.match(page, /<link rel="alternate" type="text\/plain" href="llms\.txt"/, "the page points an agent at llms.txt")
  const hidden = /<section class="sr" aria-label="For AI agents">([\s\S]*?)<\/section>/.exec(page)?.[1] ?? ""
  assert.ok(hidden.includes("https://github.com/vincenzoml/naima"), "the page's block for agents names the repository")
  const readme = readFileSync(join(NAIMA, "README.md"), "utf8")
  const llms = read("llms.txt")
  for (const [where, text] of [["the page's block for agents", hidden], ["llms.txt", llms], ["README.md", readme]] as const) {
    assert.match(text, /naima-tracker\/naima\/naima\.ts check/, where)
    assert.match(text, /naima-tracker\/naima\/skills\/naima\/SKILL\.md/, where)
    assert.match(text, /AGENTS\.md/, where)
    assert.ok(text.includes(AGENT_LINE), `${where} gives the line to paste, verbatim`)
  }
  for (const [where, text] of [["llms.txt", llms], ["README.md", readme]] as const) {
    assert.ok(text.includes(`curl -fsSL ${BASE}install.sh | sh`) && text.includes(`irm ${BASE}install.ps1 | iex`), `${where} gives the one-liners`)
    assert.match(text, /naima rules --audience agents/, where)
  }
  assert.ok(readme.startsWith("# Naima\n\nNaima turns your AI agents into a small team"), "the README opens with the site's passage")
  for (const [where, text] of [["README.md", readme], ["llms.txt", llms]] as const) {
    assert.match(text, /If git is not installed, install it[\s\S]*winget install Git\.Git/, where)
  }
  assert.match(page, /<p class="need">You don’t need to know git, code or project management\./)
  assert.match(
    page,
    /<p class="tagline">[\s\S]*?<\/p>\s*<p class="about">Software, a data analysis, a paper written with colleagues/,
    "the line under the tagline says what it is for",
  )
  assert.doesNotMatch(page, /small team/, "the long passage is the README's, not the page's")
  assert.ok(existsSync(join(NAIMA, RUNTIME_DIR, "skills", "naima", "SKILL.md")), "the skill the prompt names ships")
})

test("the logo is NAIMA on one line, named for assistive technology, its AI lit; the palette is defined once", () => {
  assert.match(page, /<h1>\s*<span class="sr">Naima<\/span>\s*<span class="mark" aria-hidden="true">/)
  const mark = /<span class="mark"[^>]*>([\s\S]*?)<\/span>\s*<\/h1>/.exec(page)?.[1] ?? ""
  assert.equal(mark.replace(/<[^>]+>/g, ""), "NAIMA")
  assert.deepEqual([...mark.matchAll(/class="ai">(\w)/g)].map((m) => m[1]), ["A", "I"])
  assert.match(page, /<span class="word branch" aria-hidden="true">/)
  assert.match(page, /site\/vertical-logo/, "the page says where the vertical logo is kept")
  assert.match(page, /site\/horizontal-maain/, "and where the main → maain intro is kept")
  const word = /<span class="letters">([\s\S]*?)<\/span>/.exec(page)?.[1] ?? ""
  assert.equal(word.replace(/<[^>]+>/g, ""), "main", "the intro starts from main, nothing inserted")
  assert.match(page, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(page, /<(?:script|link)[^>]+(?:src|href)="https?:/, "no external script or stylesheet")
  const tokens = tokensOf(page)
  for (const t of ["--bg", "--surface", "--fg", "--muted", "--line", "--accent"]) assert.match(tokens, new RegExp(`${t}:\\s+light-dark\\(`), t)
  assert.equal(page.match(/#[0-9a-f]{6}\b/gi)?.length, tokens.match(/#[0-9a-f]{6}\b/gi)?.length, "no colour outside the palette")
})

test("the page links the documentation and the repository, with room for a star count filled at build time", () => {
  assert.match(page, /<a class="link" href="https:\/\/github\.com\/vincenzoml\/naima\/tree\/main\/naima\/docs">Documentation<\/a>/)
  assert.match(page, /href="https:\/\/github\.com\/vincenzoml\/naima"[^>]*>[\s\S]*?Star on GitHub<span class="stars" hidden><\/span>/)
})

test("the build writes the star count into the page when it has one, and leaves no empty count without", () => {
  const out = mkdtempSync(join(tmpdir(), "naima-site-build-"))
  try {
    buildSite(NAIMA, out, { stars: 1234 })
    assert.match(readFileSync(join(out, "index.html"), "utf8"), /<span class="stars">1,234<\/span>/)
    buildSite(NAIMA, out)
    assert.match(readFileSync(join(out, "index.html"), "utf8"), /<span class="stars" hidden><\/span>/)
    assert.ok(existsSync(join(out, "llms.txt")) && existsSync(join(out, "install.sh")))
  } finally {
    removeTemp(out)
  }
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

// bugs/bun-s-5-second-default-test-timeout: three spawns of install.sh, each a clone and a full
// `naima check`, graze Bun's 5 second per-test default under load. Node's test runner honors the
// same option; Deno's test shim ignores what it does not need.
test(
  "install.sh installs Naima in a git repository, says so when run again, and refuses outside one",
  { skip: process.platform === "win32", timeout: 30_000 },
  () => {
    const base = mkdtempSync(join(tmpdir(), "naima-site-"))
    try {
      const source = localSource(base)
      const run = (cwd: string) =>
        spawnSync("sh", [join(SITE, "install.sh")], {
          cwd,
          encoding: "utf8",
          env: {
            ...process.env,
            NAIMA_SOURCE: source,
            NAIMA_NO_DENO_INSTALL: "1",
            GIT_CEILING_DIRECTORIES: base,
            GIT_AUTHOR_NAME: "t",
            GIT_AUTHOR_EMAIL: "t@t",
          },
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
  },
)
