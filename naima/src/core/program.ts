// The program: the Naima a project runs, in naima-tracker/naima/, locked to
// the source and commit naima.json records (docs/reference/format.md#the-lock).
//
// Carried as a copy (the default, gitignored) or vendored (the same copy,
// committed), the program is the contents of naima/ at a commit of the
// source's main, as plain files, and one file more, COPY_FILE: what it is a
// copy of. The commit is fetched, shallow, into a per-user cache — one bare
// repository per source — so a commit fetched once on this machine is copied
// again, into any project or worktree, without the network. Carried as a
// submodule, the program is git's checkout of the whole commit.
//
// None ever overwrites work: a copy whose files were changed, a checkout with
// uncommitted changes or with commits its source does not have, is refused,
// never reset. None ever pulls on its own: only `naima update` asks the
// source where its main is.

import { createHash } from "node:crypto"
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { isLocalSource, posixRelative } from "./config.ts"
import { NaimaError } from "./errors.ts"
import { writeFileAtomic } from "./files.ts"
import { gitReason, type GitRun, mustGit, runGit } from "./git.ts"
import { COPY_FILE, RUNTIME_DIR, runtimeOf } from "./layout.ts"
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
  /** The per-user cache (NAIMA_CACHE, which the launcher sets); without one, a scratch repository in the tracker folder serves one copy. */
  cache?: string
  /** Repositories on this disk that may hold the commit, tried before the source: the running Naima's own clone. */
  seeds?: string[]
}

/** What a copied program records about itself, in COPY_FILE. */
export interface Copy {
  source: string
  commit: string
  /** Every file of the copy, by its path under naima/, with its git blob id. */
  files: Record<string, string>
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
/** The code a refusal to copy a commit carries when the commit cannot be had: `naima update` can still move the lock past it. */
export const COMMIT_UNAVAILABLE = "commit-unavailable"

/** The trailer a commit of the dist branch, which projects once locked, names the main commit it was built from with. */
const SOURCE_COMMIT = /^Source-Commit: ([0-9a-f]{40}|[0-9a-f]{64})$/m

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
/** A git checkout of its own: a clone has a .git directory, a submodule a .git file. */
const isRepo = (dir: string): boolean => existsSync(join(dir, ".git"))
export const short = (commit: string): string => commit.slice(0, 12)
const where = (t: Target): string => posixRelative(t.root, t.program)
const must = (r: GitRun, what: string): string => {
  if (!r.ok) throw new Error(`${what}: ${gitReason(r)}`)
  return r.out
}
/** Git with no background maintenance: a gc racing the next command over the same objects is what a cache must not have. */
const QUIET = ["-c", "gc.auto=0", "-c", "maintenance.auto=false"]

// ---- the copy ----

/** The copy record of a program directory, or null when it holds none. */
export function readCopy(program: string): Copy | null {
  try {
    const raw = JSON.parse(readFileSync(join(program, COPY_FILE), "utf8")) as Partial<Copy>
    if (typeof raw.source !== "string" || typeof raw.commit !== "string" || !raw.files || typeof raw.files !== "object") return null
    return raw as Copy
  } catch {
    return null
  }
}

/** A file's git blob id, in the hash its repository uses (the id's length says which). */
function blobId(data: Uint8Array, like: string): string {
  return createHash(like.length === 64 ? "sha256" : "sha1").update(`blob ${data.byteLength}\0`).update(data).digest("hex")
}

/** Every file under `dir` but COPY_FILE, by its path with forward slashes: what a copy now holds. */
function filesOn(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (rel === COPY_FILE) return []
    return e.isDirectory() ? filesOn(dir, rel) : [rel]
  })
}

/** Whether the files under `dir` are exactly `files`, by content: a changed, added or removed file is a change. */
function holds(dir: string, files: Record<string, string>): boolean {
  const on = filesOn(dir)
  if (on.length !== Object.keys(files).length) return false
  return on.every((rel) => {
    const id = files[rel]
    if (!id) return false
    const path = join(dir, rel)
    const data = lstatSync(path).isSymbolicLink() ? new TextEncoder().encode(readlinkSync(path)) : readFileSync(path)
    return blobId(data, id) === id
  })
}

/** The cache repository of a source: one bare repository per source, under the per-user cache. */
function cacheRepo(t: Target): { repo: string; done: () => void } {
  const scratch = !t.cache
  const key = createHash("sha256").update(t.source).digest("hex").slice(0, 24)
  const repo = t.cache ? join(t.cache, `${key}.git`) : join(t.tracker, ".naima-fetch")
  if (scratch) rmSync(repo, { recursive: true, force: true })
  if (!existsSync(join(repo, "HEAD"))) {
    mkdirSync(dirname(repo), { recursive: true })
    must(runGit(t.root, ["init", "--quiet", "--bare", "--", repo]), `cannot make the cache ${repo}`)
  }
  return { repo, done: () => scratch && rmSync(repo, { recursive: true, force: true }) }
}

/**
 * Fetch `commit`, shallow, into the cache repository: from a repository on
 * this disk that holds it when there is one, else from the source. A ref
 * keeps it there, so a later copy needs no network.
 */
function fetchInto(repo: string, t: Target, commit: string, seeds: string[]): void {
  if (!has(repo, commit)) {
    for (const seed of seeds) {
      if (!runGit(t.root, ["-C", seed, "cat-file", "-e", `${commit}^{commit}`]).ok) continue
      runGit(repo, [...QUIET, "fetch", "--quiet", "--depth=1", "--", seed, commit])
      if (has(repo, commit)) break
    }
  }
  if (!has(repo, commit)) runGit(repo, [...QUIET, "fetch", "--quiet", "--depth=1", "--", t.source, commit])
  if (!has(repo, commit)) {
    const reach = runGit(t.root, ["ls-remote", "--", t.source, "HEAD"])
    if (!reach.ok) {
      throw new NaimaError(
        `cannot fetch from ${t.source}: ${gitReason(reach)} — a commit is copied from the network the first time this machine runs it`,
        COMMIT_UNAVAILABLE,
      )
    }
    throw new NaimaError(
      `commit ${short(commit)} cannot be fetched from ${t.source} — its history was rewritten or the source is gone; record a commit it has`,
      COMMIT_UNAVAILABLE,
    )
  }
  runGit(repo, ["update-ref", `refs/naima/${commit}`, commit])
}

/** The main commit a commit of the dist branch was built from, read from its trailer; null for any other commit. */
export function distSource(repo: string, commit: string): string | null {
  const r = runGit(repo, ["show", "-s", "--format=%B", commit])
  return r.ok ? (SOURCE_COMMIT.exec(r.out)?.[1] ?? null) : null
}

/** Whether `commit` holds the runtime folder: a commit of Naima's main, or a fork's. */
const holdsRuntime = (repo: string, commit: string): boolean => runGit(repo, ["cat-file", "-e", `${commit}:${RUNTIME_DIR}/src/cli.ts`]).ok

/** Every runtime file of `commit`, by its path under naima/, with its blob id. */
function manifest(repo: string, commit: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const line of must(runGit(repo, ["ls-tree", "-r", "-z", `${commit}:${RUNTIME_DIR}`]), "git ls-tree").split("\0")) {
    const tab = line.indexOf("\t")
    if (tab < 0) continue
    const [, type, id] = line.slice(0, tab).split(" ")
    if (type === "blob" && id) files[line.slice(tab + 1)] = id
  }
  return files
}

/** The repositories on this disk worth asking for a commit before the source: the running Naima's, a clone in the program directory, the project. */
const seedsOf = (t: Target): string[] => [...(t.seeds ?? []), ...(isRepo(t.program) ? [t.program] : []), t.root]

/**
 * Replace the program directory with the copy of naima/ at `t.commit`: fetched
 * into the cache, checked out beside the program, swapped in only once it is
 * whole. A failure anywhere leaves the program that ran before where it was.
 */
export function copyProgram(t: Target): void {
  const beside = (what: string): string => join(dirname(t.program), `.${basename(t.program)}-${what}`)
  const next = beside("next")
  const previous = beside("previous")
  const index = beside("index")
  const cache = cacheRepo(t)
  for (const path of [next, previous, index]) rmSync(path, { recursive: true, force: true })
  try {
    fetchInto(cache.repo, t, t.commit, seedsOf(t))
    verifySigned(cache.repo, t)
    if (!holdsRuntime(cache.repo, t.commit)) {
      const main = distSource(cache.repo, t.commit)
      throw new Error(
        main
          ? `commit ${short(t.commit)} is a dist commit, built from main's ${short(main)}: naima update moves the lock to a commit of main`
          : `commit ${short(t.commit)} of ${t.source} holds no ${RUNTIME_DIR}/ folder: lock a commit of Naima's main, or of a fork of it`,
      )
    }
    const files = manifest(cache.repo, t.commit)
    mkdirSync(next, { recursive: true })
    const env = { GIT_INDEX_FILE: index }
    must(runGit(cache.repo, ["read-tree", `${t.commit}:${RUNTIME_DIR}`], { env }), "git read-tree")
    must(runGit(cache.repo, ["-c", "core.autocrlf=false", `--work-tree=${next}`, "checkout-index", "--all", "--force"], { env }), "git checkout-index")
    const copy: Copy = { source: t.source, commit: t.commit, files }
    writeFileAtomic(join(next, COPY_FILE), JSON.stringify(copy, null, 2) + "\n")
    if (existsSync(t.program)) renameSync(t.program, previous)
    try {
      renameSync(next, t.program)
    } catch (e) {
      if (existsSync(previous)) renameSync(previous, t.program)
      throw e
    }
  } finally {
    for (const path of [next, previous, index]) rmSync(path, { recursive: true, force: true })
    cache.done()
  }
}

// ---- local work ----

/** Why a git checkout holds work that moving it would destroy, or null. */
export function checkoutWork(dir: string): string | null {
  if (runGit(dir, ["status", "--porcelain"]).out) return "uncommitted changes"
  if (runGit(dir, ["rev-list", "-n", "1", "HEAD", "--branches", "--not", "--remotes"]).out) return "commits its source does not have"
  return null
}

/** Why the program directory holds work that moving it would destroy, or null. */
export function localWork(t: Target): string | null {
  if (t.carry === "vendored" && runGit(t.root, ["status", "--porcelain", "--", where(t)]).out) return "uncommitted changes"
  if (isRepo(t.program)) return checkoutWork(t.program)
  const copy = readCopy(t.program)
  if (copy && !holds(t.program, copy.files)) return "changes to its files"
  return null
}

export function refuseLocalWork(t: Target): void {
  const work = localWork(t)
  if (work) throw new Error(`${where(t)} has ${work} — publish them as a fork and set source in naima.json; Naima never overwrites them`)
}

const sourceChanged = (t: Target, from: string, at: string | null): NaimaError =>
  new NaimaError(
    `the lock's source changed: ${from} → ${t.source}, locked commit moved ${at ? short(at) : "?"} → ${
      short(t.commit)
    } — Naima runs whatever that source holds, so a new one is trusted only on purpose: review the change to naima.json, then naima update --accept-source`,
    SOURCE_CHANGED,
  )

// ---- a git checkout: a submodule, and a clone of a dist commit ----

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
  // A clone names the seed's branches, not its remote-tracking refs, and the commit may be only there.
  runGit(t.program, ["fetch", "--quiet", "--", seed, lockedRefspec(t.commit)])
  mustGit(t.program, "remote", "set-url", "origin", t.source)
}

/** Make a git checkout of the program exactly the locked commit, cloning it when it is absent. */
function alignCheckout(t: Target): Moved | null {
  const fresh = !isRepo(t.program)
  let from: string | null = null
  if (fresh) {
    if (existsSync(t.program) && readdirSync(t.program).length) {
      throw new Error(`${where(t)} exists and is not a checkout — move it away, or set carry in naima.json`)
    }
    cloneProgram(t)
  } else {
    refuseLocalWork(t)
    from = runGit(t.program, ["rev-parse", "HEAD"]).out || null
    const origin = runGit(t.program, ["remote", "get-url", "origin"]).out
    if (withoutCredentials(origin) !== t.source) {
      if (!t.acceptSource) throw sourceChanged(t, withoutCredentials(origin), from)
      mustGit(t.program, "remote", "set-url", "origin", t.source)
    }
    if (from === t.commit) return null
  }
  if (!has(t.program, t.commit)) {
    runGit(t.program, ["fetch", "--quiet", "origin"])
    if (!has(t.program, t.commit)) runGit(t.program, ["fetch", "--quiet", "origin", lockedRefspec(t.commit)])
    if (!has(t.program, t.commit)) {
      throw new NaimaError(
        `commit ${short(t.commit)} cannot be fetched from ${t.source} — its history was rewritten or the source is gone; record a commit it has`,
        COMMIT_UNAVAILABLE,
      )
    }
  }
  verifySigned(t.program, t)
  mustGit(t.program, "checkout", "--quiet", "--detach", t.commit)
  return { from }
}

/**
 * Whether the locked commit is a dist commit — a commit of the branch that
 * held only naima/'s files, which projects once cloned. Such a lock keeps
 * running as a clone, as it always did, until `naima update` moves it to
 * main. Asked of a clone already in the program directory, else of the cache.
 */
function lockedDist(t: Target): boolean {
  if (isRepo(t.program) && has(t.program, t.commit)) return !holdsRuntime(t.program, t.commit) && distSource(t.program, t.commit) !== null
  const cache = cacheRepo(t)
  try {
    fetchInto(cache.repo, t, t.commit, [...seeds(t), ...seedsOf(t)])
    return !holdsRuntime(cache.repo, t.commit) && distSource(cache.repo, t.commit) !== null
  } finally {
    cache.done()
  }
}

// ---- alignment ----

/** What alignment changed: the commit the program was at before, null for a fresh copy. */
export interface Moved {
  from: string | null
}

/**
 * Make the program directory exactly the locked commit of the source:
 * copying it when it is absent or holds another commit, converting a clone
 * into a copy. Returns what moved when the code on disk changed, null when it
 * did not. Vendored, the committed tree is the lock and there is nothing to
 * align, unless it is a whole commit of main rather than a copy.
 *
 * A lock whose source is not the one the program was aligned from — a pulled
 * naima.json pointing somewhere else — is refused until it is accepted on
 * purpose (`acceptSource`): the program runs whatever that source holds.
 */
export function align(t: Target): Moved | null {
  if (t.carry === "submodule") return alignCheckout(t)
  const copy = readCopy(t.program)
  if (t.carry === "vendored") {
    if (!runtimeOf(t.program)) throw new Error(`${where(t)} is missing: carry is vendored, so it is committed — restore it from git`)
    if (copy || !existsSync(join(t.program, RUNTIME_DIR, "src", "cli.ts"))) return null
    // A whole commit of main, as an update once vendored it: the same code, as a copy of naima/ only.
    const cache = cacheRepo(t)
    try {
      fetchInto(cache.repo, t, t.commit, seedsOf(t))
      if (!holdsRuntime(cache.repo, t.commit) || !holds(join(t.program, RUNTIME_DIR), manifest(cache.repo, t.commit))) return null
    } finally {
      cache.done()
    }
    copyProgram(t)
    return { from: t.commit }
  }
  if (copy) {
    if (copy.source !== t.source && !t.acceptSource) throw sourceChanged(t, copy.source, copy.commit)
    if (copy.source === t.source && copy.commit === t.commit) return null
    refuseLocalWork(t)
    copyProgram(t)
    return { from: copy.commit }
  }
  if (isRepo(t.program)) {
    // A clone, as projects once carried the program: kept while the lock names a dist commit, converted to a copy otherwise.
    if (lockedDist(t)) return alignCheckout(t)
    refuseLocalWork(t)
    const origin = withoutCredentials(runGit(t.program, ["remote", "get-url", "origin"]).out)
    const from = runGit(t.program, ["rev-parse", "HEAD"]).out || null
    if (origin !== t.source && !t.acceptSource) throw sourceChanged(t, origin, from)
    copyProgram(t)
    return { from }
  }
  if (existsSync(t.program) && readdirSync(t.program).length) {
    throw new Error(`${where(t)} exists and is not a copy of Naima — move it away, or set carry in naima.json`)
  }
  if (lockedDist(t)) return alignCheckout(t)
  copyProgram(t)
  return { from: null }
}

/** What `naima update` follows: the branch it read, and the commit that branch points at. */
export interface Head {
  branch: string
  commit: string
}

/** The head `naima update` follows: the source's main. Reads the source; changes nothing. */
export function remoteHead(t: Target): Head {
  const r = runGit(t.root, ["ls-remote", "--", t.source, "refs/heads/main"])
  if (!r.ok) throw new Error(`cannot read main from ${t.source}: ${gitReason(r)}`)
  const commit = r.out.split(/\s+/)[0]
  if (!commit) throw new Error(`cannot read main from ${t.source}: it has no main branch`)
  return { branch: "main", commit }
}

/** The main commit the locked commit was built from, when it is a dist commit this disk holds; null otherwise. */
export function lockedDistSource(t: Target): string | null {
  for (const repo of [t.program, t.root]) {
    if (!runGit(t.root, ["-C", repo, "cat-file", "-e", `${t.commit}^{commit}`]).ok) continue
    if (holdsRuntime(repo, t.commit)) return null
    return distSource(repo, t.commit)
  }
  return null
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

  // Every switch passes through a copy.
  if (t.carry === "vendored") mustGit(t.root, "rm", "-r", "-q", "--cached", "--", rel)
  if (t.carry === "submodule") {
    mustGit(t.root, "rm", "-q", "--cached", "--", rel)
    runGit(t.root, ["config", "-f", ".gitmodules", "--remove-section", `submodule.${rel}`])
    runGit(t.root, ["config", "--remove-section", `submodule.${rel}`])
    if (existsSync(gitmodules) && !runGit(t.root, ["config", "-f", ".gitmodules", "--list"]).out) mustGit(t.root, "rm", "-q", "-f", "--", ".gitmodules")
    else if (existsSync(gitmodules)) stage(t.root, gitmodules)
  }
  if (!readCopy(t.program)) copyProgram(t)
  const ignore = (on: boolean): void => {
    const path = ignoreProgram(t, on)
    if (path) stage(t.root, path)
  }

  if (to === "copy") ignore(true)
  if (to === "vendored") {
    ignore(false)
    stage(t.root, t.program)
  }
  if (to === "submodule") {
    ignore(false)
    rmSync(t.program, { recursive: true, force: true })
    mustGit(t.root, ...allowLocal(t), "submodule", "add", "--quiet", "--", t.source, rel)
    if (!has(t.program, t.commit)) runGit(t.program, ["fetch", "--quiet", "origin", lockedRefspec(t.commit)])
    verifySigned(t.program, t)
    mustGit(t.program, "checkout", "--quiet", "--detach", t.commit)
    stage(t.root, t.program, gitmodules)
  }
}
