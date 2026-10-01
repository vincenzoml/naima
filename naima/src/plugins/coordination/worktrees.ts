// Where work happens, by one scheme: the worktree folder
// `<worktrees>/<what>` stands on the branch `<who>/<what>`, and carries a
// claim. What reads the scheme and checks it lives here; the commands that
// write claims are in ./index.ts.

import { existsSync, realpathSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { type Finding, gitOrNull, isGitRepo, trunk, type Worktree, worktrees } from "../../core/api.ts"

/** The plugin's options that shape the scheme. */
export interface Policy {
  /** Who works, when `open` is given no `--as`. */
  who?: string
  /** The worktrees directory, relative to the main worktree. */
  worktrees?: string
  /** Branches the scheme does not apply to: names, or patterns with `*`. */
  exempt: string[]
}

export function readPolicy(options: Record<string, unknown>): Policy {
  const { who, worktrees: dir, exempt = [] } = options
  if (who !== undefined && (typeof who !== "string" || !SEGMENT.test(who))) throw new Error(`coordination: option who must be a ${SEGMENT_SAYS}`)
  if (dir !== undefined && (typeof dir !== "string" || !dir)) throw new Error("coordination: option worktrees must be a path")
  if (!Array.isArray(exempt) || !exempt.every((e) => typeof e === "string")) throw new Error("coordination: option exempt must be a list of branch names")
  return { ...(who ? { who } : {}), ...(dir ? { worktrees: dir } : {}), exempt }
}

/** One segment of a branch name: what `<who>` and `<what>` each are. */
export const SEGMENT = /^[a-z0-9][a-z0-9.-]*$/
export const SEGMENT_SAYS = "lowercase name: letters a-z, digits, dots and dashes, starting with a letter or a digit"
const BRANCH = /^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9.-]*$/

const realOr = (path: string): string => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

const glob = (pattern: string): RegExp => new RegExp(`^${pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\/]/g, "\\$&")).join("[^]*")}$`)

export const isExempt = (policy: Policy, branch: string): boolean => policy.exempt.some((e) => glob(e).test(branch))

/** The main worktree: the first git lists. */
export function home(root: string, trees: Worktree[] = worktrees(root)): string {
  return trees[0]?.path ?? root
}

/** The directory every worktree is a folder of: `<main>-worktrees` beside the main worktree, unless configured. */
export function worktreesDir(policy: Policy, main: string): string {
  const dir = resolve(realOr(main), policy.worktrees ?? `../${basename(main)}-worktrees`)
  return existsSync(dir) ? realOr(dir) : dir
}

export const plural = (n: number, what: string): string => `${n} ${what}${n === 1 ? "" : "s"}`

/** How many commits `ref` has that `base` has not. */
export const ahead = (root: string, base: string, ref: string): number => Number(gitOrNull(root, "rev-list", "--count", `${base}..${ref}`) ?? 0)

/**
 * Who holds a worktree's branch: a claim with items; or, once released at
 * closing, a claim file its unmerged commits added, or a session note
 * written on it.
 */
export interface Holders {
  claimed: Set<string>
  noted: Set<string>
  /** The claims directory, as git names it: where a released claim's history is looked for. */
  claims: string
}

/**
 * The scheme, checked: every worktree but the main one is a folder of the
 * worktrees directory named for its branch's last segment; every local
 * branch but the trunk is `<who>/<what>`; and every worktree carries a claim.
 * One with commits the trunk has not and nothing holding it (no claim now,
 * none added by those commits, no session note) is a problem;
 * one with nothing on it yet is a note.
 */
export function policyFindings(root: string, policy: Policy, holders: Holders): Finding[] {
  if (!isGitRepo(root)) return []
  const out: Finding[] = []
  const main = trunk(root)
  const trees = worktrees(root)
  const dir = worktreesDir(policy, home(root, trees))
  for (const w of trees.slice(1)) {
    if (!w.branch || isExempt(policy, w.branch)) continue
    const last = w.branch.split("/").pop() ?? w.branch
    if (realOr(dirname(w.path)) !== dir) {
      out.push({ level: "problem", message: `worktree ${w.path} is outside ${dir}: a worktree is ${dir}/<what>, on <who>/<what> (naima open)` })
    } else if (basename(w.path) !== last) {
      out.push({ level: "problem", message: `worktree ${w.path} is on ${w.branch}: its folder must be named ${last}, the branch's last segment` })
    }
    if (holders.claimed.has(w.branch) || holders.noted.has(w.branch)) continue
    const n = main ? ahead(root, main, w.branch) : 0
    if (n && gitOrNull(root, "log", "-1", "--format=%H", "--diff-filter=A", `${main}..${w.branch}`, "--", holders.claims)) continue
    out.push(
      n
        ? {
          level: "problem",
          message: `worktree ${w.path} (${w.branch}) carries no claim and has ${
            plural(n, "commit")
          } not on ${main}: claim its items there (naima claim), or, once they are released, write its session note (naima pass)`,
        }
        : { level: "note", message: `worktree ${w.path} (${w.branch}) carries no claim: claim its items there before any work (naima claim)` },
    )
  }
  for (const line of (gitOrNull(root, "for-each-ref", "--format=%(refname:short)", "refs/heads") ?? "").split("\n")) {
    const b = line.trim()
    if (!b || b === main || isExempt(policy, b) || BRANCH.test(b)) continue
    out.push({
      level: "problem",
      message:
        `branch ${b} is off the naming scheme <who>/<what>, each a ${SEGMENT_SAYS}: rename it (git branch -m), or list it under the coordination plugin's exempt option`,
    })
  }
  return out
}

/** Reflog subjects of a commit made on the branch itself, rather than brought by a merge or a fast-forward. */
const DIRECT = /^(commit|commit \(amend\)|cherry-pick|revert):/

/**
 * What a branch being prepared is told about the trunk: that it has moved
 * since the branch last took it, and which of those commits the trunk's
 * reflog records as committed on it directly — outside the flow, where
 * every change arrives by a merge.
 */
export function preparingFindings(root: string, branch: string): Finding[] {
  const main = trunk(root)
  if (!main || branch === main) return []
  // A branch the trunk already holds is merged, not being prepared: its claim rode along.
  if (gitOrNull(root, "merge-base", "--is-ancestor", branch, main) !== null) return []
  const n = ahead(root, branch, main)
  if (!n) return []
  const out: Finding[] = [{
    level: "note",
    message: `${main} took ${
      plural(n, "commit")
    } ${branch} does not have, while it is being prepared: merge ${main} into it again (git merge --no-edit ${main})`,
  }]
  const missing = new Set((gitOrNull(root, "rev-list", `${branch}..${main}`) ?? "").split("\n").filter(Boolean))
  const seen = new Set<string>()
  for (const line of (gitOrNull(root, "log", "-g", "--format=%H%x09%h%x09%gs%x09%s", `refs/heads/${main}`) ?? "").split("\n")) {
    const [sha = "", short = "", how = "", subject = ""] = line.split("\t")
    if (!missing.has(sha) || seen.has(sha) || !DIRECT.test(how)) continue
    seen.add(sha)
    out.push({ level: "note", message: `${short} "${subject}" was committed on ${main} directly, outside the flow, while ${branch} was open` })
  }
  return out
}
