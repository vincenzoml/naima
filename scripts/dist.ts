// The dist branch: from a commit of main, the commit that holds only what
// runs Naima — the files dist.json allows, and nothing else — with a
// `Source-Commit:` trailer naming the main commit it was built from. CI runs
// it on every commit of main and pushes the branch (.github/workflows/ci.yml);
// projects clone and lock the dist (docs/install.md#the-dist-branch).
//
// Built with git's plumbing from the commit's own tree, never from a working
// tree, so it is reproducible: the same main commit, with the same dist.json,
// gives the same tree; with the same parent, the same commit. A main commit
// that changes no runtime file (the tracker, the tests) adds no dist commit.
//
//   deno run -A scripts/dist.ts [--commit <rev>] [--branch <name>] [--list]
//
// Standard APIs only, like the program: it runs on Deno, Node and Bun.

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type GitOptions, gitReason, runGit } from "../src/core/git.ts"
import { DIST_BRANCH } from "../src/core/layout.ts"

export const MANIFEST = "dist.json"
export const TRAILER = "Source-Commit"

export interface Manifest {
  include: string[]
  exclude: string[]
}

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

/** A glob as a regular expression: `**` any path, `*` any name part; nothing else is special. */
export function globRegex(glob: string): RegExp {
  const body = glob
    .split("/")
    .map((part) => (part === "**" ? "\uFFFF" : part.replace(/[.+^${}()|[\]\\?]/g, "\\$&").replace(/\*/g, "[^/]*")))
    .join("/")
    .replace(/\uFFFF\//g, "(?:.*/)?")
    .replace(/\/\uFFFF$/, "(?:/.*)?")
    .replace(/\uFFFF/g, ".*")
  return new RegExp(`^${body}$`)
}

export function parseManifest(text: string): Manifest {
  const raw = JSON.parse(text) as Partial<Manifest>
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string")
  if (!strings(raw.include) || !strings(raw.exclude)) throw new Error(`${MANIFEST}: include and exclude must be lists of globs`)
  return { include: raw.include, exclude: raw.exclude }
}

/** The paths, of `paths`, that the manifest ships: included by one glob and excluded by none. */
export function selectRuntime(manifest: Manifest, paths: string[]): string[] {
  const inc = manifest.include.map(globRegex)
  const exc = manifest.exclude.map(globRegex)
  return paths.filter((p) => inc.some((r) => r.test(p)) && !exc.some((r) => r.test(p))).sort()
}

/** The runtime tree of `commit`, written into the repository's objects: its hash and its files. */
export function runtimeTree(repo: string, commit: string): { tree: string; files: string[] } {
  const manifest = parseManifest(git(repo, ["show", `${commit}:${MANIFEST}`]))
  const entries = git(repo, ["ls-tree", "-r", "-z", "--full-tree", commit])
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t")
      const [mode, type, sha] = line.slice(0, tab).split(" ")
      return { mode: mode as string, type: type as string, sha: sha as string, path: line.slice(tab + 1) }
    })
    .filter((e) => e.type === "blob")
  const files = selectRuntime(manifest, entries.map((e) => e.path))
  const keep = new Set(files)
  const scratch = mkdtempSync(join(tmpdir(), "naima-dist-index-"))
  try {
    const env = { GIT_INDEX_FILE: join(scratch, "index") }
    git(repo, ["read-tree", "--empty"], { env })
    const info = entries.filter((e) => keep.has(e.path)).map((e) => `${e.mode} ${e.sha}\t${e.path}\0`).join("")
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
