import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, type Item, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import hooks, { readOptions } from "../../../naima/src/plugins/hooks/index.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

type Project = ReturnType<typeof tempProject>

/** The problems the staged-change checks find, joined: what `naima check --staged` fails on. */
const staged = async (p: Project): Promise<string> => {
  p.ctx.reload()
  return (await runChecks(p.ctx, { staged: true })).problems.map((f) => f.message).join("\n")
}

const add = (p: Project) => p.git("add", "-A")

function fixBug(p: Project, title = "Export drops alpha"): Item {
  const bug = createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), title)
  add(p)
  p.git("commit", "-q", "-m", "file the bug")
  setFields(p.ctx, bug, [["fixedOn", "2026-01-14"]])
  p.ctx.reload()
  return p.ctx.repo.resolve(bug.meta.id)
}

test("built-in rule: setting fixedOn without a linked verifying test fails, and passes once the test is in the commit", async () => {
  const p = tempProject([trackers(), hooks()], { git: true })
  try {
    const bug = fixBug(p)
    add(p)
    assert.match(await staged(p), /no item is linked to it by verified-by — companion rule fixed-has-test/)
    createItem(p.ctx, typeOrThrow(p.ctx, "tests"), "proves alpha is kept", { links: [{ rel: "verifies", id: bug.meta.id }] })
    add(p)
    assert.equal(await staged(p), "")
  } finally {
    p.cleanup()
  }
})

test("requires a field: setting fixedOn without commits fails, and passes with commits set in the same commit", async () => {
  const rule = { name: "fix-names-commits", when: { field: "fixedOn" }, requires: { field: "commits" } }
  const p = tempProject([trackers(), hooks({ builtin: false, companions: [rule] })], { git: true })
  try {
    const bug = fixBug(p)
    add(p)
    assert.match(await staged(p), /commits is not set — companion rule fix-names-commits/)
    setFields(p.ctx, bug, [["commits", p.git("rev-parse", "HEAD")]])
    add(p)
    assert.equal(await staged(p), "")
  } finally {
    p.cleanup()
  }
})

test("requires a note: a change to a feature without a note on its page fails, and passes with one", async () => {
  const rule = { name: "feature-has-note", when: { type: "features" }, requires: { note: true } }
  const p = tempProject([trackers(), hooks({ builtin: false, companions: [rule] })], { git: true })
  try {
    const feature = createItem(p.ctx, typeOrThrow(p.ctx, "features"), "Export to WebP")
    add(p)
    p.git("commit", "-q", "-m", "file it")
    setFields(p.ctx, feature, [["section", "export"]])
    add(p)
    assert.match(await staged(p), /its page has no note in this commit — companion rule feature-has-note/)
    assert.equal(await p.run("note", feature.slug, "Prioritised: the export is blocking."), 0)
    add(p)
    assert.equal(await staged(p), "")
  } finally {
    p.cleanup()
  }
})

test("requires an item of a type: a change under a path with no tests item changed fails, and passes with one", async () => {
  const rule = { name: "source-has-test", when: { paths: ["src/"] }, requires: { type: "tests" } }
  const p = tempProject([trackers(), hooks({ builtin: false, companions: [rule] })], { git: true })
  try {
    mkdirSync(join(p.root, "src"))
    writeFileSync(join(p.root, "src", "export.ts"), "export const alpha = true\n")
    add(p)
    assert.match(await staged(p), /src\/export\.ts: no item of tests is changed in this commit — companion rule source-has-test/)
    createItem(p.ctx, typeOrThrow(p.ctx, "tests"), "export keeps alpha")
    add(p)
    assert.equal(await staged(p), "")
  } finally {
    p.cleanup()
  }
})

test("nothing staged, nothing found; a field already set before the commit does not trigger again", async () => {
  const p = tempProject([trackers(), hooks()], { git: true })
  try {
    assert.equal(await staged(p), "")
    const bug = fixBug(p)
    add(p)
    p.git("commit", "-q", "--no-verify", "-m", "the fix, without its test")
    setFields(p.ctx, p.ctx.repo.resolve(bug.meta.id), [["section", "export"]])
    add(p)
    assert.equal(await staged(p), "")
  } finally {
    p.cleanup()
  }
})

test("check --staged runs only the staged-change checks", async () => {
  const p = tempProject([trackers(), hooks()], { git: true })
  try {
    assert.equal(await p.run("check", "--staged"), 0)
    assert.match(p.output.join("\n"), /\b1 staged-change checks\b/)
  } finally {
    p.cleanup()
  }
})

test("a malformed companion rule fails loading, naming it", () => {
  assert.throws(
    () => readOptions({ companions: [{ name: "x", when: { paths: ["src"] }, requires: { note: true } }] }),
    /\(x\).*only a change to an item of a type/,
  )
  assert.throws(() => readOptions({ companions: [{ name: "x", when: { field: "fixedOn" }, requires: {} }] }), /\(x\): requires names not exactly one/)
  assert.throws(() => readOptions({ companions: [{ name: "fixed-has-test", when: { field: "a" }, requires: { field: "b" } }] }), /two companion rules/)
})

/** Whether a `git commit` of what is staged succeeds, the hook running as git runs it. */
const commits = (p: Project, ...args: string[]): boolean =>
  spawnSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-q", "-m", "c", ...args], { cwd: p.root, stdio: "ignore" }).status ===
    0

test("hooks install: the hook passes over an unrelated commit without starting Naima, fails over a tracker change, and --no-verify skips it", async () => {
  // The command the hook runs, stubbed: it leaves a mark and fails, as a failing check would.
  const command = "sh -c 'touch .hook-ran; exit 1'"
  const p = tempProject([trackers(), hooks({ command })], { git: true })
  try {
    assert.equal(await p.run("hooks", "install"), 0)
    const file = join(p.ctx.trackerRoot, "hooks", "pre-commit")
    assert.equal(p.git("config", "--get", "core.hooksPath"), "naima-tracker/naima-data/hooks")
    if (process.platform !== "win32") assert.ok((statSync(file).mode & 0o111) !== 0, "the hook is executable")
    writeFileSync(join(p.root, ".gitignore"), ".hook-ran\n")
    add(p)
    assert.ok(commits(p, "--no-verify"), "the hook itself is committed, under the data directory")
    writeFileSync(join(p.root, "unrelated.txt"), "not the tracker\n")
    add(p)
    assert.ok(commits(p), "an unrelated commit passes")
    assert.ok(!existsSync(join(p.root, ".hook-ran")), "and Naima was not started")
    createItem(p.ctx, typeOrThrow(p.ctx, "bugs"), "Export drops alpha")
    add(p)
    assert.ok(!commits(p), "a tracker change runs the checks, which fail")
    assert.ok(existsSync(join(p.root, ".hook-ran")))
    assert.ok(commits(p, "--no-verify"), "--no-verify skips the hook")
  } finally {
    p.cleanup()
  }
})

test("hooks install refuses a core.hooksPath that is not Naima's, unless --force; uninstall undoes only its own", async () => {
  const p = tempProject([trackers(), hooks()], { git: true })
  try {
    p.git("config", "core.hooksPath", ".husky")
    await assert.rejects(() => p.run("hooks", "install"), /already \.husky/)
    assert.equal(await p.run("hooks", "install", "--force"), 0)
    assert.equal(p.git("config", "--get", "core.hooksPath"), "naima-tracker/naima-data/hooks")
    assert.equal(await p.run("hooks", "uninstall"), 0)
    assert.equal(spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: p.root }).status, 1)
  } finally {
    p.cleanup()
  }
})

test("the hook watches the data directory and every rule's paths, and a hook written for other rules is reported", async () => {
  const p = tempProject([trackers(), hooks()], { git: true })
  try {
    assert.equal(await p.run("hooks", "install"), 0)
    const file = join(p.ctx.trackerRoot, "hooks", "pre-commit")
    assert.match(readFileSync(file, "utf8"), /\^\(naima-tracker\/naima-data\)\(\/\|\$\)/)
    assert.match(readFileSync(file, "utf8"), /exec deno run -A 'naima-tracker\/naima\/naima\.ts' check --staged/)
    assert.equal((await runChecks(p.ctx)).problems.length, 0)
    writeFileSync(file, "#!/bin/sh\nexit 0\n")
    assert.match((await runChecks(p.ctx)).problems.map((f) => f.message).join(), /is not the hook the companion rules make now/)
    const q = tempProject([trackers(), hooks({ companions: [{ name: "src-test", when: { paths: ["src"] }, requires: { type: "tests" } }] })])
    try {
      assert.equal(await q.run("hooks"), 0)
      assert.match(q.output.join("\n"), /watched paths: naima-tracker\/naima-data, src/)
    } finally {
      q.cleanup()
    }
  } finally {
    p.cleanup()
  }
})
