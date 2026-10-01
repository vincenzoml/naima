// The dist branch: from a commit of main, the commit that holds only what
// runs Naima — a plain copy of the runtime folder, naima/, and nothing else —
// with a `Source-Commit:` trailer naming the main commit it was built from. CI
// runs it on every commit of main and pushes the branch
// (.github/workflows/ci.yml); projects clone and lock the dist
// (docs/guide/install.md#the-dist-branch).
//
// Built with git's plumbing from the commit's own tree, never from a working
// tree, so it is reproducible: the same main commit gives the same tree; with
// the same parent, the same commit. A main commit that changes nothing under
// naima/ (the tracker, the tests) adds no dist commit.
//
//   deno run -A scripts/dist.ts [--commit <rev>] [--branch <name>] [--list]
//
// Standard APIs only, like the program: it runs on Deno, Node and Bun.

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type GitOptions, gitReason, runGit } from "../naima/src/core/git.ts"
import { DIST_BRANCH, RUNTIME_DIR } from "../naima/src/core/layout.ts"

export { RUNTIME_DIR }
export const TRAILER = "Source-Commit"

/**
 * Until the documentation moves into the runtime folder, naima/docs is a
 * symbolic link to the repository's docs/: the dist holds the files it links
 * to, not the link.
 */
const LINKED_DOCS = `${RUNTIME_DIR}/docs`

export interface Built {
  /** The dist commit that holds `source`'s runtime files: new, or the branch's head when its tree is the same. */
  commit: string
  tree: string
  /** False when the branch already held this tree. */
  created: boolean
  files: string[]
}

function git(repo: string, args: string[], opts: GitOptions = {}): string {
  const r = runGit(repo, args, opts)
  if (!r.ok) throw new Error(`git ${args[0]}: ${gitReason(r)}`)
  return r.out
}

const tryGit = (repo: string, args: string[]): string | null => {
  const r = runGit(repo, args)
  return r.ok ? r.out : null
}

/**
 * Where each runtime file of `paths` (repository paths) lands in the dist:
 * every path under naima/, without the prefix. Returns [repository path, dist path] pairs, sorted by dist path.
 */
export function selectRuntime(paths: string[]): [string, string][] {
  const prefix = `${RUNTIME_DIR}/`
  const linked = paths.includes(LINKED_DOCS)
  return paths
    .filter((p) => p !== LINKED_DOCS)
    .flatMap((p): [string, string][] => {
      if (p.startsWith(prefix)) return [[p, p.slice(prefix.length)]]
      if (linked && p.startsWith("docs/")) return [[p, p]]
      return []
    })
    .sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0))
}

/** The runtime tree of `commit`, written into the repository's objects: its hash and its files. */
export function runtimeTree(repo: string, commit: string): { tree: string; files: string[] } {
  const entries = git(repo, ["ls-tree", "-r", "-z", "--full-tree", commit])
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t")
      const [mode, type, sha] = line.slice(0, tab).split(" ")
      return { mode: mode as string, type: type as string, sha: sha as string, path: line.slice(tab + 1) }
    })
    .filter((e) => e.type === "blob")
  const runtime = selectRuntime(entries.map((e) => e.path))
  const files = runtime.map(([, to]) => to)
  const byPath = new Map(entries.map((e) => [e.path, e]))
  const scratch = mkdtempSync(join(tmpdir(), "naima-dist-index-"))
  try {
    const env = { GIT_INDEX_FILE: join(scratch, "index") }
    git(repo, ["read-tree", "--empty"], { env })
    const info = runtime.map(([from, to]) => {
      const e = byPath.get(from) as (typeof entries)[number]
      return `${e.mode} ${e.sha}\t${to}\0`
    }).join("")
    git(repo, ["update-index", "-z", "--index-info"], { env, input: info })
    return { tree: git(repo, ["write-tree"], { env }), files }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/** The dist branch's head: the local branch, else the one fetched from origin. */
function distHead(repo: string, branch: string): string | null {
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    const head = tryGit(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])
    if (head) return head
  }
  return null
}

/**
 * Build the dist commit of `rev` onto `branch` and move the local branch to
 * it. Identity and dates are the source commit's committer date and a fixed
 * name, so a rebuild gives the same commit.
 */
export function buildDist(repo: string, rev = "HEAD", branch = DIST_BRANCH): Built {
  const source = git(repo, ["rev-parse", "--verify", `${rev}^{commit}`])
  const { tree, files } = runtimeTree(repo, source)
  const parent = distHead(repo, branch)
  // A run for an older commit that arrives late must not move the dist back.
  const built = parent ? sourceCommit(repo, parent) : null
  if (parent && built && built !== source && tryGit(repo, ["merge-base", "--is-ancestor", source, built]) !== null) {
    return { commit: parent, tree: git(repo, ["rev-parse", `${parent}^{tree}`]), created: false, files }
  }
  if (parent && git(repo, ["rev-parse", `${parent}^{tree}`]) === tree) {
    git(repo, ["update-ref", `refs/heads/${branch}`, parent])
    return { commit: parent, tree, created: false, files }
  }
  const [date, subject] = git(repo, ["show", "-s", "--format=%cI%n%s", source]).split("\n")
  const who = { name: "Naima dist", email: "dist@naima.invalid" }
  const env = {
    GIT_AUTHOR_NAME: who.name,
    GIT_AUTHOR_EMAIL: who.email,
    GIT_AUTHOR_DATE: date ?? "",
    GIT_COMMITTER_NAME: who.name,
    GIT_COMMITTER_EMAIL: who.email,
    GIT_COMMITTER_DATE: date ?? "",
  }
  const message = `dist of ${source.slice(0, 12)}: ${subject ?? ""}\n\n${TRAILER}: ${source}\n`
  const commit = git(repo, ["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-F", "-"], { env, input: message })
  git(repo, ["update-ref", `refs/heads/${branch}`, commit])
  return { commit, tree, created: true, files }
}

/** The main commit a dist commit was built from, read from its trailer; null when it is not a dist commit. */
export function sourceCommit(repo: string, commit: string): string | null {
  const body = git(repo, ["show", "-s", "--format=%B", commit])
  return new RegExp(`^${TRAILER}: ([0-9a-f]{40})$`, "m").exec(body)?.[1] ?? null
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const repo = process.cwd()
  const rev = option("--commit") ?? "HEAD"
  if (args.includes("--list")) {
    for (const f of runtimeTree(repo, git(repo, ["rev-parse", "--verify", `${rev}^{commit}`])).files) console.log(f)
  } else {
    const built = buildDist(repo, rev, option("--branch") ?? DIST_BRANCH)
    console.log(
      `${built.created ? "built" : "unchanged"} ${
        option("--branch") ?? DIST_BRANCH
      } ${built.commit} (tree ${built.tree}, ${built.files.length} files) from ${rev}`,
    )
  }
}
