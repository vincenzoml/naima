// The project site (site/, built by scripts/site.ts and published by
// .github/workflows/pages.yml): the page's one-liners and agent prompt name
// the files the site serves, and the README gives the same install; and the POSIX installer installs Naima for real — fresh, again, and
// refusing outside a git repository — from a source on this disk. The
// Windows installer is not run by any test.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, sep } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { buildSite, tokensOf } from "../scripts/site.ts"
import { RUNTIME_DIR } from "../naima/src/core/internal.ts"
import { gitIn as git, productRepo, removeTemp } from "./core/testing.ts"

const NAIMA = dirname(dirname(fileURLToPath(import.meta.url)))
const SITE = join(NAIMA, "site")
const BASE = "https://vincenzoml.github.io/naima/"
const read = (f: string): string => readFileSync(join(SITE, f), "utf8")
const page = read("index.html")
const prompt = /<code id="prompt">([\s\S]*?)<\/code>/.exec(page)?.[1] ?? ""

// The workshop's README and the product's (what github.com/vincenzoml/naima shows) link the site right under the title.
for (const readme of ["README.md", join(RUNTIME_DIR, "README.md")]) {
  test(`${readme} links the site right under its title`, () => {
    const lines = readFileSync(join(NAIMA, readme), "utf8").split("\n").filter((l) => l.trim())
    assert.match(lines[0] ?? "", /^# /, "the title first")
    assert.ok((lines[1] ?? "").includes(`](${BASE})`), `the line under the title links ${BASE}: ${lines[1]}`)
  })
}

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
  assert.equal(prompt, "Please install https://github.com/vincenzoml/naima in the root of this repository; create a repository at the root if missing.")
  assert.match(page, /<link rel="alternate" type="text\/plain" href="llms\.txt"/, "the page points an agent at llms.txt")
  const hidden = /<section class="sr" aria-label="For AI agents">([\s\S]*?)<\/section>/.exec(page)?.[1] ?? ""
  assert.ok(hidden.includes("https://github.com/vincenzoml/naima"), "the page's block for agents names the repository")
  const readme = readFileSync(join(NAIMA, "README.md"), "utf8")
  const llms = read("llms.txt")
  for (const [where, text] of [["the page's block for agents", hidden], ["llms.txt", llms], ["README.md", readme]] as const) {
    assert.match(text, /naima-tracker\/naima\/naima\.ts check/, where)
    assert.match(text, /naima-tracker\/naima\/skills\/naima\/SKILL\.md/, where)
    assert.match(text, /AGENTS\.md/, where)
    assert.match(
      text,
      /in the\s+root of this repository \(if it is not a git repository yet, create one\s+at the\s+root/,
      `${where} says: in the root of this repository, creating one there if missing`,
    )
    assert.ok(text.includes(AGENT_LINE), `${where} gives the line to paste, verbatim`)
  }
  for (const [where, text] of [["llms.txt", llms], ["README.md", readme]] as const) {
    assert.ok(text.includes(`curl -fsSL ${BASE}install.sh | sh`) && text.includes(`irm ${BASE}install.ps1 | iex`), `${where} gives the one-liners`)
    assert.match(text, /naima rules --audience agents/, where)
  }
  assert.ok(
    readme.startsWith(
      `# Naima\n\n**Website: [vincenzoml.github.io/naima](${BASE})**\n\nNaima is a silent software house of AI agents: it turns vibe coding into an exact science.`,
    ),
    "the README opens with the site's passage: born for software",
  )
  for (const [where, text] of [["README.md", readme], ["llms.txt", llms]] as const) {
    assert.match(text, /If git is not installed, install it[\s\S]*winget install Git\.Git/, where)
  }
  assert.match(
    page,
    /<div class="more" id="more" hidden>[\s\S]*You don’t need to know git, code or project management/,
    "the page says, under more, that no git or code knowledge is needed",
  )
  assert.match(
    page,
    /<p class="tagline">[\s\S]*?<\/p>\s*<p class="about">State-of-the-art project management and <br>software engineering, seamless, automatic, transparent\. <button type="button" class="more-toggle"/,
    "under the tagline: one line saying what Naima is, then a more toggle",
  )
  assert.doesNotMatch(page, /every claim comes with its evidence/, "the long passage is the README's, not the page's")
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

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

// bugs/bun-s-5-second-default-test-timeout: three spawns of install.sh, each a clone and a full
// `naima check`, graze Bun's 5 second per-test default under load. Node's test runner honors the
// same option; Deno's test shim ignores what it does not need.
test("install.sh installs Naima in a git repository, says so when run again, and refuses outside one", {
  skip: process.platform === "win32",
  timeout: 30_000,
}, () => {
  const base = mkdtempSync(join(tmpdir(), "naima-site-"))
  try {
    const source = productRepo(join(base, "naima"), { oldLayout: true }).dir // its history holds the old layout: tests, agent rules
    const run = (cwd: string) =>
      spawnSync("sh", [join(SITE, "install.sh")], {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          NAIMA_SOURCE: source,
          TMPDIR: join(base, "tmp"),
          NAIMA_NO_DENO_INSTALL: "1",
          GIT_CEILING_DIRECTORIES: base,
          GIT_AUTHOR_NAME: "t",
          GIT_AUTHOR_EMAIL: "t@t",
        },
      })
    const project = join(base, "project")
    mkdirSync(project)
    mkdirSync(join(base, "tmp"))
    git(project, "init", "-q", "-b", "main")

    const fresh = run(project)
    assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr)
    assert.match(fresh.stdout, /all invariants hold/)
    assert.ok(existsSync(join(project, "naima-tracker", "naima-data", "naima.json")))
    const dir = join(project, "naima-tracker", "naima")
    const program = walk(dir).map((f) => relative(dir, f).split(sep).join("/")).filter((f) => !f.startsWith(".git/")).sort()
    const runtime = git(source, "ls-tree", "-r", "--name-only", "HEAD").split("\n").sort()
    assert.deepEqual(program, runtime, "the program is the product's files, exactly")
    assert.deepEqual(program.filter((f) => f.endsWith(".test.ts")), [], "no test reaches the project")
    assert.deepEqual(program.filter((f) => f.startsWith("naima-tracker/")), [], "none of Naima's own items reaches the project")
    assert.deepEqual(program.filter((f) => /^(AGENTS|CLAUDE)\.md$/.test(f)), [], "nor Naima's agent rules")
    assert.equal(git(dir, "rev-parse", "HEAD"), git(source, "rev-parse", "main"), "a git clone of the product's main")
    assert.equal(git(dir, "config", "core.autocrlf"), "false", "LF kept, on every platform")
    assert.equal(git(project, "status", "--porcelain", "--ignored", "naima-tracker/naima"), "!! naima-tracker/naima/", "and gitignored")
    assert.deepEqual(readdirSync(join(base, "tmp")), [], "nothing is left in the temporary folder")

    const again = run(project)
    assert.equal(again.status, 0, again.stdout + again.stderr)
    assert.match(again.stdout, /already installed/)
    assert.match(again.stdout, /all invariants hold/)

    const outside = join(base, "outside")
    mkdirSync(outside)
    const refused = run(outside)
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /not a git repository/)
    assert.match(
      refused.stderr,
      /Is this the root of your project\? If so, ask your agent to create a repository here and install Naima from https:\/\/vincenzoml\.github\.io\/naima\//,
    )
    assert.ok(!existsSync(join(outside, "naima-tracker")))
  } finally {
    removeTemp(base)
  }
})

// bugs/install-ps1-fails-machine-without-deno-after: Deno's Windows installer puts deno.exe in
// ~\.deno\bin and adds it to the user's PATH, not to the running session's, so a lookup on the
// path alone fails right after a fresh install. No test runs PowerShell, so this reads the script:
// the one lookup, path then the installer's folder, is made both before and after installing.
test("install.ps1 looks for Deno where its installer puts it, before and after installing it", () => {
  const ps1 = read("install.ps1")
  const install = ps1.indexOf("Invoke-RestMethod https://deno.land/install.ps1 | Invoke-Expression")
  assert.ok(install > 0, "install.ps1 runs Deno's official installer")
  const find = /function Find-Deno \{[\s\S]*?\n {2}\}/.exec(ps1)?.[0] ?? ""
  assert.ok(
    find.includes("Get-Command deno") && find.includes("'.deno'") && find.includes("'deno.exe'"),
    "Find-Deno looks on the path, then in the installer's folder",
  )
  const after = ps1.slice(install)
  assert.match(after.split("\n").slice(0, 3).join("\n"), /\$Deno = Find-Deno/, "after installing, the same lookup runs again")
  assert.ok(!/\$Deno = Get-Command deno/.test(after), "never the path alone after installing")
})
