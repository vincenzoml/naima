// The program: the Naima a project runs, in naima-tracker/naima/, locked to
// the source and commit naima.json records (docs/reference/format.md#the-lock).
//
// Every operation here goes through git. None ever overwrites work: a program
// directory with uncommitted changes, or with commits its source does not
// have, is refused, never reset. None ever pulls on its own: only `naima
// update` asks the source where its main is.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { isLocalSource, posixRelative } from "./config.ts"
import { NaimaError } from "./errors.ts"
import { writeFileAtomic } from "./files.ts"
import { gitReason, mustGit, runGit } from "./git.ts"
import { DIST_BRANCH, runtimeOf } from "./layout.ts"
import type { Carry } from "./types.ts"

/** Where a project's program is, and what it is locked to. Paths are absolute. */
export interface Target {
  /** The project's git root. */
  root: string
  /** The tracker folder, `naima-tracker/`: what bounds every write (see trackerOf). */
  tracker: string
  program: string
  source: string
  commit: string
  carry: Carry
  /** Trust a source that differs from the one the program was aligned from: `naima update --accept-source`. */
  acceptSource?: boolean
  /** `verify: "signed"` in naima.json: run a commit only when git verifies its signature. */
  verify?: "signed"
}

/** A URL with its credentials removed: a token in a clone's origin must never reach a committed naima.json. */
export function withoutCredentials(source: string): string {
  return source.replace(/^([a-z][a-z0-9+.-]*:\/\/)([^@/]*)@/i, (all, scheme: string, userinfo: string) => {
    if (/^https?:\/\/$/i.test(scheme)) return scheme
    return userinfo.includes(":") ? `${scheme}${userinfo.slice(0, userinfo.indexOf(":"))}@` : all
  })
}

/** The code a refusal to follow a changed source carries, so `update --check` can still read the source. */
export const SOURCE_CHANGED = "source-changed"

/**
 * Refuse to run a commit whose signature git cannot verify, when the lock
 * asks for signed commits. Git runs the verification (gpg, or ssh with
 * gpg.ssh.allowedSignersFile), with the keys the user has configured.
 */
export function verifySigned(repo: string, t: Pick<Target, "source" | "commit" | "verify">): void {
  if (t.verify !== "signed") return
  const r = runGit(repo, ["verify-commit", t.commit])
  if (!r.ok) {
    throw new Error(
      `commit ${short(t.commit)} of ${t.source} carries no signature git can verify (${
        gitReason(r)
      }) — naima.json asks for verify: "signed": make its signer's key known to git, or lock a signed commit`,
    )
  }
}

const has = (repo: string, commit: string): boolean => runGit(repo, ["cat-file", "-e", `${commit}^{commit}`]).ok
const isRepo = (dir: string): boolean => existsSync(join(dir, ".git"))
export const short = (commit: string): string => commit.slice(0, 12)
const where = (t: Target): string => posixRelative(t.root, t.program)

/** Why the program directory holds work that moving it would destroy, or null. */
export function localWork(t: Target): string | null {
  if (t.carry === "vendored") return runGit(t.root, ["status", "--porcelain", "--", where(t)]).out ? "uncommitted changes" : null
  if (runGit(t.program, ["status", "--porcelain"]).out) return "uncommitted changes"
  if (runGit(t.program, ["rev-list", "-n", "1", "HEAD", "--branches", "--not", "--remotes"]).out) return "commits its source does not have"
  return null
}

export function refuseLocalWork(t: Target): void {
  const work = localWork(t)
  if (work) throw new Error(`${where(t)} has ${work} — publish them as a fork and set source in naima.json; Naima never overwrites them`)
}

/**
 * Repositories on this disk that already hold the locked commit, so a new
 * clone needs no network: the program of the main worktree, when this is
 * another worktree of the project, and the project itself (which holds
 * Naima's commits when the project is Naima).
 */
function seeds(t: Target): string[] {
  const out: string[] = []
  const common = runGit(t.root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
  if (common.ok) {
    // Asked of git, not of the file system: the main worktree is outside what Naima may read.
    const twin = join(dirname(common.out), posixRelative(t.root, t.program))
    if (resolve(twin) !== resolve(t.program) && runGit(t.root, ["-C", twin, "rev-parse", "--show-toplevel"]).out === twin) out.push(twin)
  }
  out.push(t.root)
  return out.filter((s) => runGit(t.root, ["-C", s, "cat-file", "-e", `${t.commit}^{commit}`]).ok)
}

/**
 * A commit fetched by its hash is kept as a remote-tracking ref of origin, so
 * that it counts as the source's, not as local work (localWork): the lock
 * says the source has it, and the fetch has just shown it.
 */
const lockedRefspec = (commit: string): string => `+${commit}:refs/remotes/origin/naima-locked`

function cloneProgram(t: Target): void {
  const [seed] = seeds(t)
  mkdirSync(dirname(t.program), { recursive: true })
  const r = runGit(t.root, ["clone", "--quiet", "--no-checkout", "--", seed ?? t.source, t.program])
  if (!r.ok) {
    rmSync(t.program, { recursive: true, force: true })
    throw new Error(`cannot clone ${t.source} into ${where(t)}: ${gitReason(r)} — the first run needs git and the network`)
  }
  if (!seed) return
  // A clone names the seed's branches, not its remote-tracking refs, and a dist commit may be only there.
  runGit(t.program, ["fetch", "--quiet", "--", seed, lockedRefspec(t.commit)])
  mustGit(t.program, "remote", "set-url", "origin", t.source)
}

/** What alignment changed: the commit the program was at before, null for a fresh clone. */
export interface Moved {
  from: string | null
}

/**
 * Make the program directory exactly the locked commit of the source,
 * cloning it when it is absent. Returns what moved when the code on disk
 * changed, null when it did not. Vendored, the committed tree is the lock and
 * there is nothing to align.
 *
 * A lock whose source is not the one the program was aligned from — a pulled
 * naima.json pointing somewhere else — is refused until it is accepted on
 * purpose (`acceptSource`): the program runs whatever that source holds.
 */
export function align(t: Target): Moved | null {
  if (t.carry === "vendored") {
    if (!runtimeOf(t.program)) throw new Error(`${where(t)} is missing: carry is vendored, so it is committed — restore it from git`)
    return null
  }
  const fresh = !isRepo(t.program)
  let from: string | null = null
  if (fresh) {
    if (existsSync(t.program) && readdirSync(t.program).length) {
      throw new Error(`${where(t)} exists and is not a clone — move it away, or set carry in naima.json`)
    }
    cloneProgram(t)
  } else {
    refuseLocalWork(t)
    from = runGit(t.program, ["rev-parse", "HEAD"]).out || null
    const origin = runGit(t.program, ["remote", "get-url", "origin"]).out
    if (withoutCredentials(origin) !== t.source) {
      if (!t.acceptSource) {
        throw new NaimaError(
          `the lock's source changed: ${withoutCredentials(origin)} → ${t.source}, locked commit moved ${from ? short(from) : "?"} → ${
            short(t.commit)
          } — Naima runs whatever that source holds, so a new one is trusted only on purpose: review the change to naima.json, then naima update --accept-source`,
          SOURCE_CHANGED,
        )
      }
      mustGit(t.program, "remote", "set-url", "origin", t.source)
    }
    if (from === t.commit) return null
  }
  if (!has(t.program, t.commit)) {
    runGit(t.program, ["fetch", "--quiet", "origin"])
    if (!has(t.program, t.commit)) runGit(t.program, ["fetch", "--quiet", "origin", lockedRefspec(t.commit)])
    if (!has(t.program, t.commit)) {
      throw new Error(`commit ${short(t.commit)} cannot be fetched from ${t.source} — its history was rewritten or the source is gone; record a commit it has`)
    }
  }
  verifySigned(t.program, t)
  mustGit(t.program, "checkout", "--quiet", "--detach", t.commit)
  return { from }
}

/** What `naima update` follows: the branch it read, and the commit that branch points at. */
export interface Head {
  branch: string
  commit: string
}

/**
 * The head `naima update` follows: the source's dist branch when it publishes
 * one — Naima's runtime files only, built from main (docs/guide/install.md#the-dist-branch) —
 * and its main otherwise, as a fork or a local source without a dist has.
 * Reads the source; changes nothing.
 */
export function remoteHead(t: Target): Head {
  const r = runGit(t.root, ["ls-remote", "--", t.source, `refs/heads/${DIST_BRANCH}`, "refs/heads/main"])
  if (!r.ok) throw new Error(`cannot read ${DIST_BRANCH} or main from ${t.source}: ${gitReason(r)}`)
  const heads = new Map(r.out.split("\n").map((l) => l.split(/\s+/)).map(([commit, ref]) => [ref ?? "", commit ?? ""]))
  for (const branch of [DIST_BRANCH, "main"]) {
    const commit = heads.get(`refs/heads/${branch}`)
    if (commit) return { branch, commit }
  }
  throw new Error(`cannot read ${DIST_BRANCH} or main from ${t.source}: it has neither branch`)
}

/** Vendored: replace the program with the tree of `commit`, fetched from the source into a scratch clone under the tracker folder. */
export function vendor(t: Target, commit: string): void {
  const scratch = join(t.tracker, ".naima-update")
  // The new program is checked out beside the old one and swapped in only once it is whole:
  // a failed clone, fetch or checkout leaves the program that ran before where it was.
  const beside = (what: string): string => join(dirname(t.program), `.${basename(t.program)}-${what}`)
  const next = beside("next")
  const previous = beside("previous")
  for (const dir of [scratch, next, previous]) rmSync(dir, { recursive: true, force: true })
  try {
    const r = runGit(t.root, ["clone", "--quiet", "--no-checkout", "--", t.source, scratch])
    if (!r.ok) throw new Error(`cannot clone ${t.source}: ${gitReason(r)}`)
    if (!has(scratch, commit)) mustGit(scratch, "fetch", "--quiet", "origin", commit)
    verifySigned(scratch, { ...t, commit })
    mkdirSync(next, { recursive: true })
    mustGit(scratch, `--work-tree=${next}`, "checkout", "--quiet", "--force", commit, "--", ".")
    if (existsSync(t.program)) renameSync(t.program, previous)
    try {
      renameSync(next, t.program)
    } catch (e) {
      if (existsSync(previous)) renameSync(previous, t.program)
      throw e
    }
  } finally {
    for (const dir of [scratch, next, previous]) rmSync(dir, { recursive: true, force: true })
  }
}

const IGNORE = ".gitignore"

/**
 * Add or remove the tracker folder's `.gitignore` line for the program, when
 * the program is inside the tracker folder. Returns the file's path, or null
 * when the program lives elsewhere and its ignoring is the project's affair.
 */
export function ignoreProgram(t: Target, ignored: boolean): string | null {
  const rel = posixRelative(t.tracker, t.program)
  if (!rel || rel.startsWith("..")) return null
  const line = `/${rel}/`
  const path = join(t.tracker, IGNORE)
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((l) => l !== "") : []
  const kept = lines.filter((l) => l !== line)
  const next = ignored ? [...kept, line] : kept
  if (next.length) writeFileAtomic(path, next.join("\n") + "\n")
  else rmSync(path, { force: true })
  return path
}

/** Stage `paths` (absolute), deletions included; a path that neither exists nor is tracked is skipped. */
export function stage(root: string, ...paths: string[]): void {
  const rels = paths.map((p) => posixRelative(root, p)).filter((rel) =>
    existsSync(join(root, rel)) || runGit(root, ["ls-files", "--error-unmatch", "--", rel]).ok
  )
  if (rels.length) mustGit(root, "add", "--all", "--", ...rels)
}

/** Git refuses local submodule sources by default; the project chose this one. */
const allowLocal = (t: Target): string[] => (isLocalSource(t.source) ? ["-c", "protocol.file.allow=always"] : [])

/**
 * Switch how the program is carried, staging every change, so that the switch
 * is one commit. Only git writes outside the tracker folder: `.gitmodules`,
 * in submodule mode, which git itself requires. The caller records `carry`.
 */
export function carry(t: Target, to: Carry): void {
  if (t.carry === to) return
  refuseLocalWork(t)
  const rel = where(t)
  const gitmodules = join(t.root, ".gitmodules")

  // Every switch passes through a clone.
  if (t.carry === "vendored") {
    mustGit(t.root, "rm", "-r", "-q", "--cached", "--", rel)
    rmSync(t.program, { recursive: true, force: true })
    align({ ...t, carry: "clone" })
  } else if (t.carry === "submodule") {
    mustGit(t.root, "rm", "-q", "--cached", "--", rel)
    runGit(t.root, ["config", "-f", ".gitmodules", "--remove-section", `submodule.${rel}`])
    runGit(t.root, ["config", "--remove-section", `submodule.${rel}`])
    if (existsSync(gitmodules) && !runGit(t.root, ["config", "-f", ".gitmodules", "--list"]).out) mustGit(t.root, "rm", "-q", "-f", "--", ".gitmodules")
    else if (existsSync(gitmodules)) stage(t.root, gitmodules)
  }
  const ignore = (on: boolean): void => {
    const path = ignoreProgram(t, on)
    if (path) stage(t.root, path)
  }

  if (to === "clone") ignore(true)
  if (to === "vendored") {
    rmSync(join(t.program, ".git"), { recursive: true, force: true })
    ignore(false)
    stage(t.root, t.program)
  }
  if (to === "submodule") {
    ignore(false)
    mustGit(t.root, ...allowLocal(t), "submodule", "add", "--quiet", "--", t.source, rel)
    stage(t.root, t.program, gitmodules)
  }
}
