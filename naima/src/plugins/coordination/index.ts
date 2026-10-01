// Who is working on what, and where each session left off — without any
// session ever writing a file another session writes.
//
//   <data>/claims/<uuid>.json        one per branch that claims work
//   <data>/passes/<date>-<uuid>.md   one per session note
//
// Both are written on the writer's own branch, never staged, never committed
// by the tool. The collections are recombined at read time from every branch.

import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import {
  allRefNames,
  bool,
  type BranchFile,
  type Check,
  type Command,
  type Context,
  CONTRACT,
  currentBranch,
  filesAt,
  type Finding,
  type Item,
  label,
  parse,
  type Plugin,
  positiveInt,
  readAcrossBranches,
  rendered,
  str,
  type SummarySection,
  today,
  usageError,
  writeFileAtomic,
  type WriteHook,
  writeJson,
} from "../../core/api.ts"

export const CLAIMS = "claims"
export const PASSES = "passes"

export interface ClaimEntry {
  id: string
  ref: string
  title: string
}

export interface Claim {
  branch: string
  claimedAt: string
  note?: string
  items: ClaimEntry[]
  file: string
  /** The ref it was read from; this worktree's branch when `local`. */
  ref: string
  local: boolean
}

export interface Pass {
  file: string
  date: string
  at: string
  branch: string
  body: string
  local: boolean
}

/** A coordination directory, from the project root, with forward slashes: it is also a path in git. */
const rel = (ctx: Context, dir: string): string => `${ctx.trackerDir}/${dir}`

function parseClaim(f: BranchFile): Claim | null {
  try {
    const c = JSON.parse(f.text) as Partial<Claim>
    if (!Array.isArray(c.items)) return null
    const items = c.items.filter((e): e is ClaimEntry => typeof e?.id === "string")
    return { branch: c.branch ?? f.ref, claimedAt: c.claimedAt ?? "", ...(c.note ? { note: c.note } : {}), items, file: f.name, ref: f.ref, local: f.local }
  } catch {
    return null // an unreadable claim is one row missing, never a broken listing
  }
}

/** The branch a claim file records, read without trusting the rest of it. */
function claimBranch(f: BranchFile): string | undefined {
  try {
    const branch = (JSON.parse(f.text) as { branch?: unknown }).branch
    return typeof branch === "string" ? branch : undefined
  } catch {
    return undefined
  }
}

export function readClaims(ctx: Context): Claim[] {
  return readAcrossBranches(ctx.root, rel(ctx, CLAIMS), ".json", { owner: claimBranch })
    .map(parseClaim)
    .filter((c): c is Claim => c !== null)
}

const FRONT = /^---\n([\s\S]*?)\n---\n/

function parsePass(f: BranchFile): Pass | null {
  const m = f.text.match(FRONT)
  if (!m?.[1]) return null
  const field = (k: string) => m[1]?.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? ""
  const date = field("date")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return { file: f.name, date, at: field("at"), branch: field("branch") || f.ref, body: f.text.slice(m[0].length).trim(), local: f.local }
}

/** Every session note on every branch, newest first by instant. */
export function readPasses(ctx: Context): Pass[] {
  const key = (p: Pass) => p.at || p.date
  return readAcrossBranches(ctx.root, rel(ctx, PASSES), ".md")
    .map(parsePass)
    .filter((p): p is Pass => p !== null)
    .sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : a.file < b.file ? 1 : -1))
}

function writeClaim(ctx: Context, claim: Claim): string {
  const dir = join(ctx.root, rel(ctx, CLAIMS))
  mkdirSync(dir, { recursive: true })
  const { file, ref: _ref, local: _local, ...body } = claim
  writeJson(join(dir, file), body)
  return join(rel(ctx, CLAIMS), file)
}

/** This branch's claim: the one on this worktree's disk, else one another ref carries for it. */
function myClaim(ctx: Context, branch: string, all: Claim[] = readClaims(ctx)): Claim | undefined {
  return all.find((c) => c.local && c.branch === branch) ?? all.find((c) => c.branch === branch)
}

/**
 * A new claim for this branch. When the branch committed a claim file and has
 * since deleted it (every item released, the deletion not yet committed), the
 * same file is written again rather than a second one beside it.
 */
function freshClaim(ctx: Context, branch: string): Claim {
  const committed = filesAt(ctx.root, "HEAD", rel(ctx, CLAIMS), ".json").map(parseClaim).find((c) => c?.branch === branch)
  return { branch, claimedAt: today(ctx), items: [], file: committed?.file ?? `${randomUUID()}.json`, ref: branch, local: true }
}

const claim: Command = {
  name: "claim",
  says: "record that this branch is working on items (writes one file on this branch)",
  usage: 'claim <item>... [--note "why"]',
  options: [{ name: "--note", says: "why this branch holds the items; replaces the previous note" }],
  examples: ['claim export-drops export-keeps --note "alpha channel in the exporter"'],
  run(args, ctx) {
    const p = parse(args, { note: { type: "string" } })
    if (!p.positionals.length) throw usageError(this)
    const items = p.positionals.map((r) => ctx.repo.resolve(r))
    const branch = currentBranch(ctx.root)
    if (branch === "HEAD") throw new Error("HEAD is detached: a claim belongs to a branch — git switch -c <branch>, then claim")
    const all = readClaims(ctx)
    const mine = myClaim(ctx, branch, all) ?? freshClaim(ctx, branch)
    const note = str(p, "note")
    if (note) mine.note = note
    for (const item of items) {
      if (mine.items.some((e) => e.id === item.meta.id)) {
        ctx.out(`already claimed on ${branch}: ${label(item)}`)
        continue
      }
      const others = all.filter((c) => c.branch !== branch && c.items.some((e) => e.id === item.meta.id)).map((c) => c.branch)
      if (others.length) ctx.out(`note: also claimed by ${others.join(", ")} — allowed, and worth knowing`)
      mine.items.push({ id: item.meta.id, ref: label(item), title: item.meta.title })
      ctx.out(`claimed ${label(item)}`)
    }
    ctx.out(`wrote ${writeClaim(ctx, mine)} — commit it on ${branch} with your work`)
    return 0
  },
}

const release: Command = {
  name: "release",
  says: "drop this branch's claim on items; the last one removes the file",
  usage: "release <item>...",
  examples: ["release export-drops"],
  run(args, ctx) {
    const refs = parse(args).positionals
    if (!refs.length) throw usageError(this)
    const branch = currentBranch(ctx.root)
    const mine = myClaim(ctx, branch)
    if (!mine) throw new Error(`nothing to release: ${branch} holds no claim here`)
    const ids = new Set(refs.map((r) => ctx.repo.resolve(r).meta.id))
    const kept = mine.items.filter((e) => !ids.has(e.id))
    if (kept.length === mine.items.length) throw new Error(`none of ${refs.join(", ")} is claimed on ${branch}; nothing changed`)
    ctx.out(`released ${mine.items.length - kept.length} on ${branch}`)
    if (kept.length === 0 && mine.local) {
      unlinkSync(join(ctx.root, rel(ctx, CLAIMS), mine.file))
      ctx.out(`removed ${join(rel(ctx, CLAIMS), mine.file)} — commit the deletion on ${branch}`)
    } else {
      // A claim read from another ref cannot be deleted from here: an emptied copy on this branch overrides it.
      mine.items = kept
      ctx.out(`wrote ${writeClaim(ctx, mine)}`)
    }
    return 0
  },
}

const claims: Command = {
  name: "claims",
  says: "who holds what, recombined from every branch",
  usage: "claims [--branch <b>]",
  options: [{ name: "--branch", says: "only the claim of this branch" }],
  examples: ["claims", "claims --branch fix/export-alpha"],
  run(args, ctx) {
    const p = parse(args, { branch: { type: "string" } })
    const only = str(p, "branch")
    const here = currentBranch(ctx.root)
    const list = readClaims(ctx).filter((c) => !only || c.branch === only)
    if (!list.some((c) => c.items.length)) ctx.out("no claims")
    for (const c of list) {
      ctx.out(`${c.branch}${c.branch === here ? "  ← here" : ""}${c.local ? "  (working tree)" : ""}${c.note ? `  — ${c.note}` : ""}`)
      for (const e of c.items) ctx.out(`  ${e.ref}  ${e.title}`)
    }
    const holders = new Map<string, Set<string>>()
    for (const c of list) for (const e of c.items) holders.set(e.id, (holders.get(e.id) ?? new Set()).add(c.branch))
    const contested = [...holders].filter(([, b]) => b.size > 1)
    if (contested.length) {
      ctx.out("\nclaimed by more than one branch (allowed):")
      for (const [id, b] of contested) ctx.out(`  ${ctx.repo.byId.get(id) ? label(ctx.repo.byId.get(id) as Item) : id} → ${[...b].join(", ")}`)
    }
    return 0
  },
}

const prune: Command = {
  name: "prune",
  says:
    "list (or with --write remove) claim files naming a branch git no longer has; one only another ref carries is listed with that ref, to be dropped there",
  usage: "prune [--write]",
  options: [{ name: "--write", says: "remove the stale claim files instead of listing them" }],
  examples: ["prune", "prune --write"],
  run(args, ctx) {
    const write = bool(parse(args, { write: { type: "boolean" } }), "write")
    const alive = allRefNames(ctx.root)
    const stale = readClaims(ctx).filter((c) => !alive.has(c.branch))
    if (!stale.length) {
      ctx.out("every claim names a branch that exists")
      return 0
    }
    // Only a file on this disk can be removed from here; one another ref carries is dropped on that ref.
    const here = stale.filter((c) => c.local)
    const elsewhere = stale.filter((c) => !c.local)
    for (const c of here) ctx.out(`  ${c.branch}  ${c.items.length} items  ${c.file}`)
    for (const c of elsewhere) {
      ctx.out(`  ${c.branch}  ${c.items.length} items  ${c.file}  on ${c.ref}: drop it there (git switch ${c.ref}, naima prune --write)`)
    }
    if (!write) {
      ctx.out("nothing removed — run again with --write")
      return 0
    }
    for (const c of here) unlinkSync(join(ctx.root, rel(ctx, CLAIMS), c.file))
    ctx.out(
      `removed ${here.length} here${elsewhere.length ? `; ${elsewhere.length} must be dropped on its ref` : ""} — commit the deletions on ${
        currentBranch(ctx.root)
      }`,
    )
    return 0
  },
}

const pass: Command = {
  name: "pass",
  says: "write this session's note (one new file), or list the newest",
  usage: 'pass "<what changed, what is proven, what is left>" | pass --file <f> | pass --list [n]',
  options: [
    { name: "--file", says: "read the note from a file instead of the arguments" },
    { name: "--list", says: "print the newest n notes across every branch instead of writing one", default: "5" },
  ],
  examples: ['pass "Exporter keeps alpha; proof owed: tests/export-keeps-alpha"', "pass --file note.md", "pass --list 3"],
  run(args, ctx) {
    const p = parse(args, { file: { type: "string" }, list: { type: "boolean" } })
    if (bool(p, "list")) {
      const n = positiveInt(p.positionals[0], 5, "pass --list")
      const passes = readPasses(ctx).slice(0, n)
      if (!passes.length) ctx.out("no session notes")
      for (const s of passes) ctx.out(`── ${s.date}  ${s.branch}${s.local ? "  (working tree)" : ""}\n${s.body}\n`)
      return 0
    }
    const file = str(p, "file")
    const text = (file ? readFileSync(file, "utf8") : p.positionals.join(" ")).trim()
    if (!text) throw usageError(this)
    const now = ctx.now()
    const date = now.toISOString().slice(0, 10)
    const branch = currentBranch(ctx.root)
    const dir = join(ctx.root, rel(ctx, PASSES))
    mkdirSync(dir, { recursive: true })
    const name = `${date}-${randomUUID()}.md`
    writeFileAtomic(join(dir, name), `---\ndate: ${date}\nat: ${now.toISOString()}\nbranch: ${branch}\n---\n\n${text}\n`)
    ctx.out(`wrote ${join(rel(ctx, PASSES), name)} — commit it on ${branch} with the work it describes`)
    return 0
  },
}

const claimsResolve: Check = {
  name: "claims-resolve",
  says: "a claim written in this worktree names items that exist",
  run: (ctx) =>
    readClaims(ctx)
      .filter((c) => c.local)
      .flatMap((c) =>
        c.items.filter((e) => !ctx.repo.byId.has(e.id)).map((e): Finding => ({
          level: "note",
          message: `claim ${c.file} names ${e.ref} (${e.id}), which is not here`,
        }))
      ),
}

/**
 * AGENTS.md: a branch does not close its own items on the strength of its own
 * tests. Its own items are the ones it claims; closing one there is marking
 * its own homework, so it waits for the trunk — or for `--force`, from the
 * one who owns the evidence.
 */
const noClosingOwnWork: WriteHook = {
  name: "no-closing-own-claims",
  says:
    "archiving an item (a move to a type that is not creatable, as naima close does) that the branch you stand on claims is refused unless --force: a branch does not close its own items on the strength of its own tests",
  beforeWrite(write, ctx) {
    if (write.kind !== "move" || write.to?.creatable !== false || write.force) return
    const branch = currentBranch(ctx.root)
    if (branch === "HEAD") return // detached: no branch, so no claim of its own
    const id = write.item.meta.id
    if (!readClaims(ctx).some((c) => c.branch === branch && c.items.some((e) => e.id === id))) return
    return `${
      label(write.item)
    } is claimed by ${branch}, the branch you are on: a branch does not close its own items on the strength of its own tests — merge the work and close it from the trunk once someone else has checked the proof, or pass --force if you own the evidence`
  },
}

const whereWeWere: SummarySection = {
  name: "where we were",
  render(ctx) {
    const [newest, ...rest] = readPasses(ctx)
    const data = newest
      ? { date: newest.date, branch: newest.branch, lines: newest.body.split("\n").slice(0, 8), sameDay: rest.filter((p) => p.date === newest.date).length }
      : null
    return rendered(
      data,
      (d) =>
        d ? [`  ${d.date}  ${d.branch}`, ...d.lines.map((l) => `  ${l}`), ...(d.sameDay ? [`  (+${d.sameDay} more that day — naima pass --list)`] : [])] : [],
    )
  },
}

const inHand: SummarySection = {
  name: "in hand",
  render(ctx) {
    const data = readClaims(ctx).filter((c) => c.items.length).map((c) => ({ branch: c.branch, items: c.items.map((e) => e.ref) }))
    return rendered(data, (claims) => claims.map((c) => `  ${c.branch}: ${c.items.join(", ")}`))
  },
}

export default function coordination(): Plugin {
  return {
    name: "coordination",
    contract: CONTRACT,
    says: "claims and session notes, one file per session, recombined from every branch",
    about:
      "No session writes a file another session writes. A claim is one file per branch, `claims/<uuid>.json`; a session note is one file per session, `passes/<date>-<uuid>.md`. " +
      "Both are written on the writer's own branch and never staged or committed by the tool: commit them with the work. " +
      "`claims`, `pass --list` and `summary` recombine them at read time from every local branch — the trunk, every branch not merged into it, whatever each worktree stands on — each read from the disk of the worktree that stands on it, uncommitted files included, or from its ref when none does; remote-tracking refs are not read. " +
      "The trunk is the branch origin's HEAD names, else `main`, else `master`; without one, every local branch is read. A claim belongs to a branch, so on a detached HEAD `claim` is refused. " +
      "Several branches may claim one item: `claim` says who else holds it rather than refusing.",
    dirs: [CLAIMS, PASSES],
    checks: [claimsResolve],
    commands: [claim, release, claims, prune, pass],
    summary: [whereWeWere, inHand],
    hooks: [noClosingOwnWork],
  }
}
