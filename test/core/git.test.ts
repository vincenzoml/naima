import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { test } from "node:test"
import { gitCalls, gitOrNull, gitReason, mustGit, runGit } from "../../naima/src/core/git.ts"
import { gitPath, projectFiles, readAcrossBranches, refsWorthReading, trunk, walkFiles } from "../../naima/src/core/internal.ts"
import { gitIn, tempProject } from "./testing.ts"

test("records are recombined from every unmerged branch, with the working tree winning", () => {
  const p = tempProject([], { git: true })
  try {
    const dir = join(p.root, "rec")
    const put = (name: string, text: string) => {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, name), text)
    }
    p.git("checkout", "-q", "-b", "one")
    put("a.txt", "from one")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "one")
    p.git("checkout", "-q", "main")
    rmSync(dir, { recursive: true, force: true })
    put("b.txt", "uncommitted on main")
    assert.deepEqual(refsWorthReading(p.root), ["one", "main"])
    const files = readAcrossBranches(p.root, "rec", ".txt").map((f) => [f.name, f.ref, f.local, f.text])
    assert.deepEqual(files.sort(), [
      ["a.txt", "one", false, "from one"],
      ["b.txt", "main", true, "uncommitted on main"],
    ])
    // once merged, the branch adds nothing and is no longer read
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "b")
    p.git("merge", "-q", "--no-edit", "one")
    assert.deepEqual(refsWorthReading(p.root), ["main"])
  } finally {
    p.cleanup()
  }
})

test("a test's commit starts no background maintenance, so a local clone right after it finds every object", () => {
  const base = mkdtempSync(join(tmpdir(), "naima-maint-"))
  try {
    const src = join(base, "src")
    mkdirSync(src)
    gitIn(src, "init", "-q", "-b", "main")
    // The repository asks for maintenance after every commit, in the foreground: were it to run, the commit
    // would return with its loose objects packed (in the background, packed and deleted under the clone).
    for (
      const [key, value] of [["gc.auto", "1"], ["gc.autoDetach", "false"], ["maintenance.autoDetach", "false"], ["maintenance.loose-objects.enabled", "true"], [
        "maintenance.loose-objects.auto",
        "1",
      ]]
    ) {
      gitIn(src, "config", key as string, value as string)
    }
    for (let i = 0; i < 20; i++) writeFileSync(join(src, `f${i}`), `${i}\n`)
    gitIn(src, "add", "-A")
    gitIn(src, "commit", "-q", "-m", "many objects")
    const counts = gitIn(src, "count-objects", "-v")
    assert.match(counts, /^count: 22$/m, "20 blobs, a tree and a commit, all still loose")
    assert.match(counts, /^packs: 0$/m, "no maintenance packed them")
    gitIn(base, "clone", "-q", "--", src, "clone/nested") // relative target, hardlinked objects: the failing shape
    assert.equal(gitIn(join(base, "clone", "nested"), "rev-parse", "HEAD"), gitIn(src, "rev-parse", "HEAD"))
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test("a project's files are regular files: never a submodule's directory, never through a symbolic link", () => {
  const p = tempProject([], { git: true })
  const outside = mkdtempSync(join(tmpdir(), "naima-outside-"))
  try {
    writeFileSync(join(outside, "secret.md"), "outside the repository\n")
    mkdirSync(join(outside, "tree"))
    writeFileSync(join(outside, "tree", "deep.ts"), "outside\n")
    mkdirSync(join(p.root, "src"))
    writeFileSync(join(p.root, "src", "a.ts"), "inside\n")
    symlinkSync(join(outside, "secret.md"), join(p.root, "src", "leak.md"))
    symlinkSync(join(outside, "tree"), join(p.root, "src", "tree"), "dir")
    // A submodule: git lists its path, and on disk it is a directory.
    mkdirSync(join(p.root, "vendor.md"))
    p.git("update-index", "--add", "--cacheinfo", `160000,${p.git("rev-parse", "HEAD")},vendor.md`)
    const files = projectFiles(p.root).filter((f) => !f.startsWith("naima-tracker/"))
    assert.deepEqual(files, ["src/a.ts"])
    rmSync(join(p.root, ".git"), { recursive: true, force: true })
    assert.deepEqual(projectFiles(p.root).filter((f) => !f.startsWith("naima-tracker/")), ["src/a.ts"])
    assert.deepEqual(walkFiles(join(p.root, "src")).map((f) => relative(p.root, f)), [join("src", "a.ts")])
  } finally {
    p.cleanup()
    rmSync(outside, { recursive: true, force: true })
  }
})

test("paths meet git in posix form, whatever the platform's separator", () => {
  assert.equal(gitPath("naima-tracker\\naima-data\\claims", "\\"), "naima-tracker/naima-data/claims")
  assert.equal(gitPath("naima-tracker/naima-data/claims", "/"), "naima-tracker/naima-data/claims")
  const p = tempProject([], { git: true })
  try {
    mkdirSync(join(p.root, "src", "deep"), { recursive: true })
    writeFileSync(join(p.root, "src", "deep", "a.ts"), "x\n")
    rmSync(join(p.root, ".git"), { recursive: true, force: true })
    assert.ok(projectFiles(p.root).includes("src/deep/a.ts"), "outside git too, a project file is a posix path")
  } finally {
    p.cleanup()
  }
})

test("reading across branches starts a bounded number of git processes, however many branches and files", () => {
  const p = tempProject([], { git: true })
  try {
    const dir = "naima-tracker/naima-data/claims"
    const calls = (): number => {
      const before = gitCalls()
      readAcrossBranches(p.root, dir, ".json")
      return gitCalls() - before
    }
    const branches = (from: number, to: number): void => {
      for (let n = from; n < to; n++) {
        p.git("checkout", "-q", "-b", `b${n}`, "main")
        mkdirSync(join(p.root, dir), { recursive: true })
        for (const k of [1, 2, 3]) writeFileSync(join(p.root, dir, `b${n}-${k}.json`), `{"n":${n}}\n`)
        p.git("add", "-A")
        p.git("commit", "-q", "-m", `b${n}`)
      }
      p.git("checkout", "-q", "main")
    }
    branches(0, 2)
    const few = calls()
    branches(2, 10)
    const many = calls()
    assert.equal(readAcrossBranches(p.root, dir, ".json").length, 30)
    assert.equal(many, few, `2 branches took ${few} git processes, 10 took ${many}`)
    assert.ok(many <= 8, `${many} git processes for one read`)
  } finally {
    p.cleanup()
  }
})

test("the trunk is origin's HEAD, main or master — and without any, every local branch is read; a detached HEAD is not a ref to read", () => {
  const p = tempProject([], { git: true })
  try {
    const record = (branch: string, name: string) => {
      p.git("checkout", "-q", "-b", branch)
      mkdirSync(join(p.root, "rec"), { recursive: true })
      writeFileSync(join(p.root, "rec", name), branch)
      p.git("add", "-A")
      p.git("commit", "-q", "-m", branch)
    }
    const names = () => readAcrossBranches(p.root, "rec", ".txt").map((f) => `${f.name}@${f.ref}`).sort()
    p.git("branch", "-m", "main", "develop")
    record("feature", "f.txt")
    p.git("checkout", "-q", "develop")
    assert.equal(trunk(p.root), null)
    assert.deepEqual(names(), ["f.txt@feature"], "no main or master: every local branch is read")

    p.git("update-ref", "refs/remotes/origin/develop", "develop")
    p.git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/develop")
    assert.equal(trunk(p.root), "develop")
    assert.deepEqual(refsWorthReading(p.root), ["feature", "develop"])
    assert.deepEqual(names(), ["f.txt@feature"])

    // A commit made on a detached HEAD, its record deleted on disk: not read back from the HEAD's own sha.
    p.git("checkout", "-q", "--detach", "develop")
    mkdirSync(join(p.root, "rec"), { recursive: true })
    writeFileSync(join(p.root, "rec", "d.txt"), "detached")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "detached")
    rmSync(join(p.root, "rec", "d.txt"))
    assert.deepEqual(names(), ["f.txt@feature"])
  } finally {
    p.cleanup()
  }
})

test("one git wrapper: a missing ref and a missing git binary are told apart", () => {
  const p = tempProject([], { git: true })
  try {
    const noRef = runGit(p.root, ["rev-parse", "--verify", "no-such-branch"])
    assert.deepEqual([noRef.ok, noRef.notInstalled], [false, false])
    assert.match(gitReason(noRef), /needed a single revision|unknown revision|no-such-branch/i)
    const noGit = runGit(p.root, ["status"], { env: { PATH: join(p.root, "nowhere") } })
    assert.deepEqual([noGit.ok, noGit.notInstalled], [false, true])
    assert.match(gitReason(noGit), /git is not installed, or not on PATH/)
    assert.equal(gitOrNull(p.root, "rev-parse", "--verify", "no-such-branch"), null)
    assert.equal(gitOrNull(p.root, "rev-parse", "--abbrev-ref", "HEAD"), "main")
    assert.throws(() => mustGit(p.root, "rev-parse", "--verify", "no-such-branch"), /^Error: git rev-parse: /)
  } finally {
    p.cleanup()
  }
})

test("a branch checked out in another worktree is read from that worktree's disk, uncommitted files and deletions included", () => {
  const p = tempProject([], { git: true })
  const w1 = `${p.root}-w1`
  const w2 = `${p.root}-w2`
  try {
    mkdirSync(join(p.root, "rec"))
    writeFileSync(join(p.root, "rec", "old.txt"), "on main\n")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "old")
    p.git("worktree", "add", "-q", "-b", "w1", w1)
    p.git("worktree", "add", "-q", "-b", "w2", w2)
    writeFileSync(join(w1, "rec", "one.txt"), "w1, not committed\n")
    writeFileSync(join(w2, "rec", "two.txt"), "w2, not committed\n")
    const names = (root: string) => readAcrossBranches(root, "rec", ".txt").map((f) => `${f.name}@${f.ref}${f.local ? " (here)" : ""}`).sort()
    assert.deepEqual(names(p.root), ["old.txt@main (here)", "one.txt@w1", "two.txt@w2"], "the trunk sees both workers' uncommitted records")
    assert.deepEqual(names(w1), ["old.txt@w1 (here)", "one.txt@w1 (here)", "two.txt@w2"], "and each worker sees the other's")
    writeFileSync(join(w2, "rec", "mine.txt"), "w2's own\n")
    gitIn(w2, "add", "-A")
    gitIn(w2, "commit", "-q", "-m", "w2 records")
    rmSync(join(w2, "rec", "mine.txt"))
    assert.ok(!names(p.root).some((n) => n.startsWith("mine")), "committed on w2, deleted there and not yet committed: gone everywhere")
    // A worktree whose directory is gone is read from its branch, as committed.
    rmSync(w2, { recursive: true, force: true })
    assert.deepEqual(names(p.root), ["mine.txt@w2", "old.txt@main (here)", "one.txt@w1", "two.txt@w2"], "read from its branch, as committed")
  } finally {
    p.cleanup()
    rmSync(w1, { recursive: true, force: true })
    rmSync(w2, { recursive: true, force: true })
  }
})
