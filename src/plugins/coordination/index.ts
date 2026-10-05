// Who is working on what, and where each session left off — without any
// session ever writing a file another session writes.
//
//   <data>/claims/<uuid>.json        one per branch that claims work: items, shared; resources, exclusive
//   <data>/passes/<date>-<uuid>.md   one per session note
//
// Both are written on the writer's own branch, never staged, never committed
// by the tool. The collections are recombined at read time from every branch.

import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  align,
  allRefNames,
  appliesTo,
  bool,
  type BranchFile,
  type Check,
  type Command,
  type Context,
  CONTRACT,
  currentBranch,
  fieldValue,
  filesAt,
  type Finding,
  gitOrNull,
  isClone,
  label,
  mustGit,
  parse,
  type Plugin,
  positiveInt,
  posixRelative,
  readAcrossBranches,
  rendered,
  short,
  str,
  strs,
  type SummarySection,
  today,
  trunk,
  usageError,
  worktrees,
  writeFileAtomic,
  type WriteHook,
  writeJson,
} from "../../core/api.ts"
import {
  ahead,
  exists,
  home,
  plural,
  type Policy,
  policyFindings,
  preparingFindings,
  readPolicy,
  SEGMENT,
  SEGMENT_SAYS,
  worktreesDir,
  writeThroughGit,
} from "./worktrees.ts"
import { claimsUiView, notesUiView } from "./ui.ts"
import { readResources, refusal, type Resource, type ResourcesData, resourcesData } from "./resources.ts"
import { diaryCommand, eventCommand, EVENTS, timelineUiView, timelineView } from "./timeline.ts"

export { type Timeline, type TimelineEvent, timelineOf } from "./timeline.ts"
export { type Holder, type Resource, type ResourcesData } from "./resources.ts"

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
  /** The branch is being prepared to enter the trunk: it is told when the trunk moves under it. */
  preparing?: true
  items: ClaimEntry[]
  /** The declared resources this branch holds, each by no other branch: absent when none. */
  resources?: string[]
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
  /** The acknowledgement line it was written with (`pass --ack`), recorded as it was valid then — a rule change later never invalidates it. */
  ack?: string
  body: string
  local: boolean
}

/**
 * The day acknowledgement lines shipped: a note dated this day or earlier is
 * grandfathered, the way a closed item on the day `commits` shipped is
 * (`trackers`' `commitsRequiredFrom`) — `sessionNoteAck` holds only a note
 * dated strictly after it.
 */
export const ACK_REQUIRED_FROM = "2026-10-02"

/** A coordination directory, from the project root, with forward slashes: it is also a path in git. */
const rel = (ctx: Context, dir: string): string => `${ctx.trackerDir}/${dir}`

function parseClaim(f: BranchFile): Claim | null {
  try {
    const c = JSON.parse(f.text) as Partial<Claim>
    if (!Array.isArray(c.items)) return null
    const items = c.items.filter((e): e is ClaimEntry => typeof e?.id === "string")
    const resources = Array.isArray(c.resources) ? c.resources.filter((r): r is string => typeof r === "string") : []
    return {
      branch: c.branch ?? f.ref,
      claimedAt: c.claimedAt ?? "",
      ...(c.note ? { note: c.note } : {}),
      ...(c.preparing === true ? { preparing: true as const } : {}),
      items,
      ...(resources.length ? { resources } : {}),
      file: f.name,
      ref: f.ref,
      local: f.local,
    }
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
  const ack = field("ack")
  return {
    file: f.name,
    date,
    at: field("at"),
    branch: field("branch") || f.ref,
    ...(ack ? { ack } : {}),
    body: f.text.slice(m[0].length).trim(),
    local: f.local,
  }
}

/** Every session note on every branch, newest first by instant. */
export function readPasses(ctx: Context): Pass[] {
  const key = (p: Pass) => p.at || p.date
  return readAcrossBranches(ctx.root, rel(ctx, PASSES), ".md")
    .map(parsePass)
    .filter((p): p is Pass => p !== null)
    .sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : a.file < b.file ? 1 : -1))
}

/**
 * The acknowledgement phrases `pass --ack` must see, agents-audience rules
 * first, must before should — read generically through the registry, by
 * field name, since plugins never import each other: whichever plugin (the
 * rules plugin, in this project) declares `ack`, `audience` and `strength`
 * on a type, and sets an item of it to `status: active`.
 */
function expectedAcks(ctx: Context): string[] {
  const ack = ctx.registry.fields.get("ack")
  if (!ack) return []
  const audience = ctx.registry.fields.get("audience")
  const strength = ctx.registry.fields.get("strength")
  const rank = (i: (typeof ctx.repo.items)[number]) => {
    const s = strength ? fieldValue(i, strength) : undefined
    return s === "must" ? 0 : s === "should" ? 1 : 2
  }
  return ctx.repo.items
    .filter((i) => i.meta.status === "active" && appliesTo(ack, i.type))
    .filter((i) => {
      if (!audience) return true
      const a = fieldValue(i, audience)
      return a === "agents" || a === "everyone" || a === undefined
    })
    .sort((a, b) => rank(a) - rank(b))
    .map((i) => fieldValue(i, ack))
    .filter((v): v is string => typeof v === "string" && v.length > 0)
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

/** A claim that holds nothing: no item, no resource. */
const empty = (c: Claim): boolean => !c.items.length && !c.resources?.length

/** Every declared resource and who holds it, recombined from every branch now. */
const resourcesNow = (ctx: Context, declared: Map<string, Resource>, all: Claim[] = readClaims(ctx)): ResourcesData =>
  resourcesData(declared, all, allRefNames(ctx.root))

const claimCommand = (declared: Map<string, Resource>): Command => ({
  name: "claim",
  says: "record that this branch is working on items, or holds a resource no other branch may hold (writes one file on this branch)",
  enforces:
    "a claim belongs to a branch, never to a detached HEAD, and is one file on that branch; a resource is one the configuration declares, and is refused, naming the holder, while another branch holds it",
  usage: 'claim <item>... [--resource <name>]... [--note "why"] [--preparing | --not-preparing]',
  options: [
    {
      name: "--resource",
      says:
        "take a declared resource (plugins.coordination.options.resources) for this branch: refused, naming the holder, while another branch holds it; repeatable, items optional",
    },
    { name: "--note", says: "why this branch holds the items; replaces the previous note" },
    {
      name: "--preparing",
      says:
        "mark the branch as being prepared to enter the trunk: from then on naima check notes every commit the trunk takes that the branch lacks, and every one committed on the trunk directly; items are optional",
    },
    { name: "--not-preparing", says: "drop the mark" },
  ],
  examples: [
    'claim export-drops export-keeps --note "alpha channel in the exporter"',
    'claim --resource site --note "publishing the site"',
    "claim --preparing",
  ],
  run(args, ctx) {
    const p = parse(args, {
      note: { type: "string" },
      preparing: { type: "boolean" },
      "not-preparing": { type: "boolean" },
      resource: { type: "string", multiple: true },
    })
    const preparing = bool(p, "preparing") ? true : bool(p, "not-preparing") ? false : undefined
    const wanted = strs(p, "resource")
    if (bool(p, "preparing") && bool(p, "not-preparing")) throw usageError(this)
    if (!p.positionals.length && preparing === undefined && !wanted.length) throw usageError(this)
    for (const r of wanted) {
      if (!declared.has(r)) {
        throw new Error(
          declared.size
            ? `${r} is not a declared resource: ${[...declared.keys()].join(", ")}`
            : `${r} is not a declared resource: none is declared (plugins.coordination.options.resources)`,
        )
      }
    }
    const items = p.positionals.map((r) => ctx.repo.resolve(r))
    const branch = currentBranch(ctx.root)
    if (branch === "HEAD") throw new Error("HEAD is detached: a claim belongs to a branch — git switch -c <branch>, then claim")
    const all = readClaims(ctx)
    if (wanted.length) {
      const now = resourcesNow(ctx, declared, all)
      const refused = wanted.map((r) => refusal(r, branch, now)).filter((m): m is string => m !== null)
      if (refused.length) throw new Error(refused.join("\n"))
    }
    const held = myClaim(ctx, branch, all)
    if (!held && !items.length && !wanted.length) throw new Error(`${branch} holds no claim: claim its items first (naima claim <item>...)`)
    const mine = held ?? freshClaim(ctx, branch)
    const note = str(p, "note")
    if (note) mine.note = note
    if (preparing === true) mine.preparing = true
    if (preparing === false) delete mine.preparing
    if (preparing !== undefined) ctx.out(`${branch} is ${preparing ? "" : "no longer "}being prepared to enter the trunk`)
    if (preparing === false && !items.length && !wanted.length && empty(mine) && mine.local) {
      unlinkSync(join(ctx.root, rel(ctx, CLAIMS), mine.file))
      ctx.out(`removed ${join(rel(ctx, CLAIMS), mine.file)}, which held only the mark — commit the deletion on ${branch}`)
      return 0
    }
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
    for (const r of wanted) {
      if (mine.resources?.includes(r)) {
        ctx.out(`already held by ${branch}: ${r}`)
        continue
      }
      mine.resources = [...(mine.resources ?? []), r]
      ctx.out(`holds ${r} (claim ${mine.file.replace(/\.json$/, "")}): no other branch may claim it until naima release --resource ${r}`)
    }
    ctx.out(`wrote ${writeClaim(ctx, mine)} — commit it on ${branch} with your work`)
    return 0
  },
})

const release: Command = {
  name: "release",
  says: "drop this branch's claim on items or resources; the last one removes the file, unless the branch is being prepared (claim --preparing)",
  enforces: "only this branch's own claim is dropped, and only on items and resources it holds; while the branch is being prepared, the emptied file is kept",
  usage: "release <item>... [--resource <name>]...",
  options: [{ name: "--resource", says: "give back a resource this branch holds, so another branch may claim it; repeatable" }],
  examples: ["release export-drops", "release --resource site"],
  run(args, ctx) {
    const p = parse(args, { resource: { type: "string", multiple: true } })
    const refs = p.positionals
    const freed = strs(p, "resource")
    if (!refs.length && !freed.length) throw usageError(this)
    const branch = currentBranch(ctx.root)
    const mine = myClaim(ctx, branch)
    if (!mine) throw new Error(`nothing to release: ${branch} holds no claim here`)
    for (const r of freed) if (!mine.resources?.includes(r)) throw new Error(`${branch} does not hold ${r}; nothing changed`)
    const ids = new Set(refs.map((r) => ctx.repo.resolve(r).meta.id))
    const kept = mine.items.filter((e) => !ids.has(e.id))
    if (refs.length && kept.length === mine.items.length) throw new Error(`none of ${refs.join(", ")} is claimed on ${branch}; nothing changed`)
    if (refs.length) ctx.out(`released ${mine.items.length - kept.length} on ${branch}`)
    const keptResources = (mine.resources ?? []).filter((r) => !freed.includes(r))
    for (const r of freed) ctx.out(`released ${r}: another branch may claim it`)
    if (kept.length === 0 && !keptResources.length && mine.local && !mine.preparing) {
      unlinkSync(join(ctx.root, rel(ctx, CLAIMS), mine.file))
      ctx.out(`removed ${join(rel(ctx, CLAIMS), mine.file)} — commit the deletion on ${branch}`)
    } else {
      // A claim read from another ref cannot be deleted from here: an emptied copy on this branch overrides it.
      mine.items = kept
      if (keptResources.length) mine.resources = keptResources
      else delete mine.resources
      ctx.out(`wrote ${writeClaim(ctx, mine)}`)
      if (!kept.length && mine.preparing) ctx.out(`kept, empty, while ${branch} is being prepared: naima claim --not-preparing removes it`)
    }
    return 0
  },
}

/** Who holds what, as `naima claims --json` prints it and the window's claims panel shows it. */
export interface ClaimsData {
  claims: {
    branch: string
    here: boolean
    local: boolean
    claimedAt: string
    note?: string
    preparing?: true
    items: ClaimEntry[]
    resources?: string[]
  }[]
  /** The items more than one branch claims — allowed, and worth knowing. */
  contested: { id: string; ref: string; branches: string[] }[]
}

/** Every claim, recombined from every branch now — only `only`'s when given — and the items more than one holds. */
export function claimsData(ctx: Context, only?: string): ClaimsData {
  const here = currentBranch(ctx.root)
  const list = readClaims(ctx).filter((c) => !only || c.branch === only)
  const holders = new Map<string, Set<string>>()
  for (const c of list) for (const e of c.items) holders.set(e.id, (holders.get(e.id) ?? new Set()).add(c.branch))
  return {
    claims: list.map((c) => ({
      branch: c.branch,
      here: c.branch === here,
      local: c.local,
      claimedAt: c.claimedAt,
      ...(c.note ? { note: c.note } : {}),
      ...(c.preparing ? { preparing: true as const } : {}),
      items: c.items,
      ...(c.resources ? { resources: c.resources } : {}),
    })),
    contested: [...holders].filter(([, b]) => b.size > 1).map(([id, b]) => {
      const item = ctx.repo.byId.get(id)
      return { id, ref: item ? label(item) : id, branches: [...b] }
    }),
  }
}

const claimsCommand = (declared: Map<string, Resource>): Command => ({
  name: "claims",
  says: "who holds what, recombined from every branch; with --resources, every declared resource and its one holder, or free",
  enforces: "nothing: it only reads",
  usage: "claims [--branch <b>] [--json] | claims --resources [--json]",
  options: [
    { name: "--branch", says: "only the claim of this branch" },
    { name: "--json", says: "print the claims as JSON: each branch's items, resources, note and marks, and the items more than one branch holds" },
    {
      name: "--resources",
      says:
        "list every declared resource with its holder — branch, claim id, since when, gone from git or not — or free; with --json, { resources: [{ name, says, role, declared, holders }] }",
    },
  ],
  examples: ["claims", "claims --branch fix/export-alpha", "claims --json", "claims --resources", "claims --resources --json"],
  run(args, ctx) {
    const p = parse(args, { branch: { type: "string" }, json: { type: "boolean" }, resources: { type: "boolean" } })
    if (bool(p, "resources")) {
      if (str(p, "branch")) throw usageError(this)
      const r = resourcesNow(ctx, declared)
      if (bool(p, "json")) {
        ctx.out(JSON.stringify(r, null, 2))
        return 0
      }
      if (!r.resources.length) ctx.out("no resources declared (plugins.coordination.options.resources)")
      for (const res of r.resources) {
        const who = res.holders.length
          ? res.holders.map((h) => `${h.branch}${h.stale ? " (branch gone: naima prune)" : ""}  claim ${h.claim}  since ${h.claimedAt || "?"}`).join("; ")
          : "free"
        ctx.out(`  ${res.name}  ${who}  — ${res.says}${res.role ? ` (role ${res.role})` : ""}`)
        if (res.holders.length > 1) ctx.out(`    held by more than one branch: all but one must release it`)
      }
      return 0
    }
    const d = claimsData(ctx, str(p, "branch"))
    if (bool(p, "json")) {
      ctx.out(JSON.stringify(d, null, 2))
      return 0
    }
    if (!d.claims.some((c) => c.items.length || c.resources?.length)) ctx.out("no claims")
    for (const c of d.claims) {
      ctx.out(`${c.branch}${c.here ? "  ← here" : ""}${c.local ? "  (working tree)" : ""}${c.note ? `  — ${c.note}` : ""}`)
      for (const e of c.items) ctx.out(`  ${e.ref}  ${e.title}`)
      if (c.resources?.length) ctx.out(`  holds ${c.resources.join(", ")}`)
    }
    if (d.contested.length) {
      ctx.out("\nclaimed by more than one branch (allowed):")
      for (const c of d.contested) ctx.out(`  ${c.ref} → ${c.branches.join(", ")}`)
    }
    return 0
  },
})

/** The tag that keeps a branch's commits once the branch is deleted. */
export const archiveTag = (branch: string): string => `archive/${branch}`

/**
 * Delete a branch and the worktree standing on it. A branch with commits the
 * trunk has not is deleted only when its archive tag holds them: `--archive`
 * makes the tag first.
 */
function pruneBranch(ctx: Context, branch: string, write: boolean, archive: boolean): number {
  const main = trunk(ctx.root)
  if (!main) throw new Error("no trunk (main, master, or origin's HEAD): nothing to measure the branch against")
  if (branch === main) throw new Error(`${branch} is the trunk: it is never pruned`)
  if (gitOrNull(ctx.root, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`) === null) throw new Error(`no branch ${branch}`)
  const tree = worktrees(ctx.root).find((w) => w.branch === branch)
  if (tree?.self) throw new Error(`${branch} is the worktree you stand in: prune it from another one`)
  const tag = archiveTag(branch)
  const n = ahead(ctx.root, main, branch)
  const kept = gitOrNull(ctx.root, "rev-parse", "--verify", "--quiet", `refs/tags/${tag}`) !== null &&
    gitOrNull(ctx.root, "merge-base", "--is-ancestor", branch, `refs/tags/${tag}`) !== null
  const unkept = n > 0 && !kept
  if (unkept) {
    const why = `${branch} has ${plural(n, "commit")} not on ${main} and no ${tag} tag holding them`
    if (!archive) {
      if (write) throw new Error(`${why}: deleting it would lose them — pass --archive to tag them as ${tag} first`)
      ctx.out(`${why}: --archive tags them first`)
    }
  }
  const plan = [
    ...(unkept && archive ? [`tag ${tag} at ${branch}`] : []),
    ...(tree ? [`remove the worktree ${tree.path}`] : []),
    `delete the branch ${branch}`,
  ]
  if (!write) {
    ctx.out(`would ${plan.join(", ")} — run again with --write`)
    return 0
  }
  if (unkept && archive) mustGit(ctx.root, "tag", tag, branch)
  if (tree) mustGit(ctx.root, "worktree", "remove", tree.path)
  mustGit(ctx.root, "branch", "-D", branch)
  ctx.out(`did ${plan.join(", ")}${kept || (unkept && archive) ? ` — its commits stay on ${tag}` : ""}`)
  return 0
}

const prune: Command = {
  name: "prune",
  says:
    "list (or with --write remove) claim files naming a branch git no longer has — a resource such a claim holds is held by no one alive, and listed with it; one only another ref carries is listed with that ref, to be dropped there. With --branch, delete a branch and its worktree, refusing one with unmerged commits that no archive/<branch> tag holds",
  enforces: "the trunk is never pruned, and a branch with unmerged commits that no archive/<branch> tag holds is refused; nothing is removed without --write",
  usage: "prune [--write] | prune --branch <b> [--archive] [--write]",
  options: [
    { name: "--write", says: "remove the stale claim files, or the branch and its worktree, instead of listing what would go" },
    { name: "--branch", says: "the branch to delete, with the worktree standing on it" },
    { name: "--archive", says: "tag the branch's commits as archive/<branch> before deleting it, so none is lost" },
  ],
  examples: ["prune", "prune --write", "prune --branch claude/old-idea --archive --write"],
  run(args, ctx) {
    const p = parse(args, { write: { type: "boolean" }, branch: { type: "string" }, archive: { type: "boolean" } })
    const write = bool(p, "write")
    const branch = str(p, "branch")
    if (branch) return pruneBranch(ctx, branch, write, bool(p, "archive"))
    if (bool(p, "archive")) throw usageError(this)
    const alive = allRefNames(ctx.root)
    const stale = readClaims(ctx).filter((c) => !alive.has(c.branch))
    if (!stale.length) {
      ctx.out("every claim names a branch that exists")
      return 0
    }
    // Only a file on this disk can be removed from here; one another ref carries is dropped on that ref.
    const here = stale.filter((c) => c.local)
    const elsewhere = stale.filter((c) => !c.local)
    const holds = (c: Claim) => `${c.items.length} items${c.resources?.length ? `, holds ${c.resources.join(", ")}` : ""}`
    for (const c of here) ctx.out(`  ${c.branch}  ${holds(c)}  ${c.file}`)
    for (const c of elsewhere) {
      ctx.out(`  ${c.branch}  ${holds(c)}  ${c.file}  on ${c.ref}: drop it there (git switch ${c.ref}, naima prune --write)`)
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
  enforces:
    "a session note is one new file: earlier ones are never rewritten; --ack is refused unless it carries every phrase the project's active rules ask an agent to acknowledge",
  usage: 'pass "<what changed, what is proven, what is left>" [--ack "<line>"] | pass --file <f> [--ack "<line>"] | pass --list [n] [--json]',
  options: [
    { name: "--file", says: "read the note from a file instead of the arguments" },
    {
      name: "--ack",
      says:
        "the acknowledgement line the project's rules ask for (naima rules --audience agents, last line) — written first, and refused if a phrase is missing from it",
    },
    { name: "--list", says: "print the newest n notes across every branch instead of writing one", default: "5" },
    { name: "--json", says: "with --list, print the notes as JSON: each one's date, instant, branch, ack, file and text" },
  ],
  examples: [
    'pass "Exporter keeps alpha; proof owed: tests/export-keeps-alpha" --ack "Acknowledge: Quiet mode on"',
    "pass --file note.md",
    "pass --list 3",
    "pass --list 3 --json",
  ],
  run(args, ctx) {
    const p = parse(args, { file: { type: "string" }, ack: { type: "string" }, list: { type: "boolean" }, json: { type: "boolean" } })
    if (bool(p, "json") && !bool(p, "list")) throw usageError(this)
    if (bool(p, "list")) {
      const n = positiveInt(p.positionals[0], 5, "pass --list")
      const passes = readPasses(ctx).slice(0, n)
      if (bool(p, "json")) {
        ctx.out(JSON.stringify(passes, null, 2))
        return 0
      }
      if (!passes.length) ctx.out("no session notes")
      for (const s of passes) ctx.out(`── ${s.date}  ${s.branch}${s.local ? "  (working tree)" : ""}\n${s.body}\n`)
      return 0
    }
    const file = str(p, "file")
    const text = (file ? readFileSync(file, "utf8") : p.positionals.join(" ")).trim()
    if (!text) throw usageError(this)
    const ack = str(p, "ack")
    if (ack !== undefined) {
      const missing = expectedAcks(ctx).filter((phrase) => !ack.includes(phrase))
      if (missing.length) {
        throw new Error(
          `pass --ack is missing: ${missing.join(" · ")} — naima rules --audience agents prints the line to give back`,
        )
      }
    }
    const now = ctx.now()
    const date = now.toISOString().slice(0, 10)
    const branch = currentBranch(ctx.root)
    const dir = join(ctx.root, rel(ctx, PASSES))
    mkdirSync(dir, { recursive: true })
    const name = `${date}-${randomUUID()}.md`
    const body = ack ? `${ack}\n\n${text}` : text
    writeFileAtomic(
      join(dir, name),
      `---\ndate: ${date}\nat: ${now.toISOString()}\nbranch: ${branch}${ack ? `\nack: ${ack}` : ""}\n---\n\n${body}\n`,
    )
    ctx.out(`wrote ${join(rel(ctx, PASSES), name)} — commit it on ${branch} with the work it describes`)
    return 0
  },
}

/** `open`: the worktree, the policy-named branch and the claim, in one step. */
function openCommand(policy: Policy): Command {
  return {
    name: "open",
    says: "start a piece of work: a worktree <worktrees>/<what> on a new branch <who>/<what> from the trunk, and its claim on the items, in one step",
    enforces: "work happens on its own branch and worktree from the trunk, and its claim on the items is recorded in the same step",
    usage: 'open <item>... [--as <who>] [--name <what>] [--note "why"]',
    options: [
      { name: "--as", says: "who works: the branch's first segment", ...(policy.who ? { default: policy.who } : {}) },
      { name: "--name", says: "what the work is: the branch's last segment and the worktree's folder", default: "the first item's slug" },
      { name: "--note", says: "why the branch holds the items, written in the claim" },
    ],
    examples: ['open export-drops --as claude --note "alpha channel in the exporter"', "open export-drops export-keeps --as claude --name export-alpha"],
    run(args, ctx) {
      const p = parse(args, { as: { type: "string" }, name: { type: "string" }, note: { type: "string" } })
      if (!p.positionals.length) throw usageError(this)
      const who = str(p, "as") ?? policy.who
      if (!who) throw new Error("open needs --as <who>, the branch's first segment, or the coordination plugin's who option")
      const items = p.positionals.map((r) => ctx.repo.resolve(r))
      const what = str(p, "name") ?? items[0]?.slug ?? ""
      for (const [flag, value] of [["--as", who], ["--name", what]] as const) {
        if (!SEGMENT.test(value)) throw new Error(`${flag} ${value}: each part of a branch name is a ${SEGMENT_SAYS}`)
      }
      const branch = `${who}/${what}`
      const trees = worktrees(ctx.root)
      const path = join(worktreesDir(policy, home(ctx.root, trees)), what)
      if (gitOrNull(ctx.root, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`) !== null) {
        throw new Error(`branch ${branch} already exists: pick another --name, or work in it where it stands`)
      }
      if (exists(path)) throw new Error(`${path} already exists: pick another --name`)
      const base = trunk(ctx.root) ?? "HEAD"
      mustGit(ctx.root, "worktree", "add", "-q", "-b", branch, path, base)
      const newProgram = join(path, posixRelative(ctx.root, ctx.program))
      if (!isClone(ctx.program)) {
        ctx.out(`${posixRelative(ctx.root, ctx.program)} is not a program clone yet: ${path} will align its own on its first run (naima check)`)
      } else {
        const newData = join(path, ctx.trackerDir)
        align({
          root: path,
          tracker: dirname(newData),
          program: newProgram,
          source: ctx.config.source,
          commit: ctx.config.commit,
          ...(ctx.config.verify ? { verify: ctx.config.verify } : {}),
          seeds: [ctx.program],
        })
        ctx.out(`cloned ${posixRelative(path, newProgram)} from ${posixRelative(ctx.root, ctx.program)}, at ${short(ctx.config.commit)} — no network`)
      }
      const others = readClaims(ctx)
      const claim: Claim = { branch, claimedAt: today(ctx), items: [], file: `${randomUUID()}.json`, ref: branch, local: true }
      const note = str(p, "note")
      if (note) claim.note = note
      for (const item of items) {
        if (claim.items.some((e) => e.id === item.meta.id)) continue
        const holders = others.filter((c) => c.items.some((e) => e.id === item.meta.id)).map((c) => c.branch)
        if (holders.length) ctx.out(`note: ${label(item)} is also claimed by ${holders.join(", ")} — allowed, and worth knowing`)
        claim.items.push({ id: item.meta.id, ref: label(item), title: item.meta.title })
      }
      // The new worktree is outside what this run may write: git writes the claim there.
      const { file: name, ref: _ref, local: _local, ...body } = claim
      const file = `${rel(ctx, CLAIMS)}/${name}`
      writeThroughGit(path, file, JSON.stringify(body, null, 2) + "\n")
      ctx.out(`opened ${path} on ${branch}, from ${base}`)
      ctx.out(`claimed ${claim.items.map((e) => e.ref).join(", ")} in ${file} — commit it on ${branch} with the work`)
      ctx.out(`next: cd ${path}, and install the dependencies a fresh checkout lacks`)
      return 0
    },
  }
}

/** Who holds each branch, for the policy: a claim with items, or a session note written on it. */
const holders = (ctx: Context) => ({
  claimed: new Set(readClaims(ctx).filter((c) => !empty(c)).map((c) => c.branch)),
  noted: new Set(readPasses(ctx).map((p) => p.branch)),
  claims: rel(ctx, CLAIMS),
})

function worktreePolicy(policy: Policy): Check {
  return {
    name: "worktree-policy",
    says:
      "every worktree but the main one is <worktrees>/<what> on the branch <who>/<what>, every local branch but the trunk is <who>/<what>, and every worktree carries a claim — one with commits the trunk lacks and no claim, now or released in those commits, nor a session note, is a problem for the worktree being checked, and (unless naima check --all-worktrees) a note naming any other worktree in the same state",
    run: (ctx, options) => policyFindings(ctx.root, policy, holders(ctx), options),
  }
}

const trunkMoved: Check = {
  name: "trunk-moved-while-preparing",
  says:
    "a branch whose claim is marked preparing is told every commit the trunk took that it lacks, and which of them the trunk's reflog records as committed on the trunk directly",
  run: (ctx) => readClaims(ctx).filter((c) => c.preparing).flatMap((c) => preparingFindings(ctx.root, c.branch)),
}

/** A resource has one holder: two branches holding it is a problem; a holder gone from git, or a resource no longer declared, a note. */
const resourcesOneHolder = (declared: Map<string, Resource>): Check => ({
  name: "resources-one-holder",
  says:
    "every resource a claim holds is held by one branch only (a problem otherwise), by a branch git still has, and is one the configuration declares (notes otherwise)",
  run(ctx) {
    return resourcesNow(ctx, declared).resources.flatMap((r): Finding[] => [
      ...(r.holders.length > 1
        ? [{
          level: "problem" as const,
          message: `${r.name} is held by ${
            [...new Set(r.holders.map((h) => h.branch))].join(", ")
          }: a resource has one holder — all but one release it (naima release --resource ${r.name})`,
        }]
        : []),
      ...r.holders.filter((h) => h.stale).map((h): Finding => ({
        level: "note",
        message: `${r.name} is held by ${h.branch}, a branch git no longer has (claim ${h.claim}): naima prune lists it`,
      })),
      ...(!r.declared && r.holders.length
        ? [{ level: "note" as const, message: `${r.name} is held but not declared (plugins.coordination.options.resources): release it, or declare it` }]
        : []),
    ])
  },
})

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

/**
 * The check counterpart of no-closing-own-claims: a hand edit (a directory
 * moved into the archive, meta.json rewritten) never meets the hook, so the
 * state it protects is asserted here — nothing the branch you stand on claims
 * is archived.
 */
const closedNotClaimed: Check = {
  name: "closed-not-claimed",
  says:
    "no archived item (one in a type that is not creatable, where naima close moves it) is claimed by the branch you stand on: what no-closing-own-claims refuses on a write, asserted on the tracker as it is, hand edits included",
  run(ctx) {
    const branch = currentBranch(ctx.root)
    if (branch === "HEAD") return []
    const mine = new Set(readClaims(ctx).filter((c) => c.branch === branch).flatMap((c) => c.items.map((e) => e.id)))
    return ctx.repo.items
      .filter((i) => mine.has(i.meta.id) && ctx.registry.types.get(i.type)?.creatable === false)
      .map((i): Finding => ({
        level: "problem",
        item: i,
        message: `${
          label(i)
        } is closed, yet ${branch}, the branch you are on, claims it: a branch does not close its own items — move it back, or, if the evidence owner closed it, release the claim (naima release ${i.slug})`,
      }))
  },
}

const sessionNoteAck: Check = {
  name: "session-note-ack",
  says:
    `a session note dated after ${ACK_REQUIRED_FROM} carries the acknowledgement line it was written with (naima pass --ack), and its body still begins with it — a rule change afterwards never invalidates a note already written, since what was asked of it then is what it recorded`,
  run(ctx) {
    return readPasses(ctx)
      .filter((p) => p.date > ACK_REQUIRED_FROM)
      .flatMap((p): Finding[] => {
        if (!p.ack) {
          return [{ level: "problem", message: `${p.file}: a session note dated ${p.date} carries no acknowledgement line — naima pass --ack "<line>"` }]
        }
        if (!p.body.startsWith(p.ack)) {
          return [{ level: "problem", message: `${p.file}: its body no longer begins with the acknowledgement line it was written with` }]
        }
        return []
      })
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
    const data = readClaims(ctx).filter((c) => !empty(c)).map((c) => ({ branch: c.branch, items: c.items.map((e) => e.ref), resources: c.resources ?? [] }))
    return rendered(data, (claims) => claims.map((c) => `  ${c.branch}: ${[...c.items, ...c.resources.map((r) => `resource ${r}`)].join(", ")}`))
  },
}

export default function coordination(options: Record<string, unknown> = {}): Plugin {
  const policy = readPolicy(options)
  const declared = readResources(options)
  return {
    name: "coordination",
    contract: CONTRACT,
    says: "claims and session notes, one file per session, recombined from every branch; the timeline, derived from the items and git",
    about:
      "No session writes a file another session writes. A claim is one file per branch, `claims/<uuid>.json`; a session note is one file per session, `passes/<date>-<uuid>.md`. " +
      "Both are written on the writer's own branch and never staged or committed by the tool: commit them with the work. " +
      "`claims`, `pass --list` and `summary` recombine them at read time from every local branch — the trunk, every branch not merged into it, whatever each worktree stands on — each read from the disk of the worktree that stands on it, uncommitted files included, or from its ref when none does; remote-tracking refs are not read. " +
      "The trunk is the branch origin's HEAD names, else `main`, else `master`; without one, every local branch is read. A claim belongs to a branch, so on a detached HEAD `claim` is refused. " +
      "Several branches may claim one item: `claim` says who else holds it rather than refusing. " +
      "A resource is the opposite: one branch at a time. The resources are data, `resources` (name → `says`, and the `role` that holds it, when one does); `claim --resource <name>` records it in the branch's claim file, beside its items, and is refused, naming the holder, while another branch holds it; `release --resource <name>` gives it back; `claims --resources` lists each with its holder or free; `prune` lists a holder whose branch is gone, and `naima check` flags a resource two branches hold. " +
      "Work happens by one scheme, checked: the worktree `<worktrees>/<what>` stands on the branch `<who>/<what>` and carries a claim; `open` makes all three in one step. " +
      "A claim marked `--preparing` is told when the trunk moves under it, and which commits were made on the trunk directly; `prune --branch` deletes a branch only when the trunk or an `archive/<branch>` tag holds its commits. " +
      "`naima view timeline` derives every event, with nothing stored: a gate opened is its first item reported (`created`), a gate passed its last item resolved (`closedOn`, else `fixedOn`) once none is open; an epic the same, from the items it groups; a release is a version tag, dated by its commit; a session is its note. " +
      "What has no date is counted at the foot, never placed at a guess. Only what nothing derives — a decision taken elsewhere, a build handed out, a policy, an outside fact — is a record, one file per event, `events/<date>-<uuid>.md`, written by `naima event`. " +
      `\`pass --ack "<line>"\` writes the acknowledgement line whichever plugin declares a rule's \`ack\` field asks an agent to give back — refused if a phrase is missing from it — and records it in the note's front matter; a note dated after ${ACK_REQUIRED_FROM} missing it, or whose body no longer starts with it, is a problem (\`session-note-ack\`), tolerating one written before — on the day it shipped, or earlier, grandfathered like a closed item on the day \`commits\` shipped — since what it recorded is what the rules asked then.`,
    options: [
      { name: "who", says: "who works, when `naima open` is given no `--as`: the branch's first segment" },
      {
        name: "worktrees",
        says: "the directory every worktree is a folder of, relative to the main worktree",
        default: "../<main worktree's folder>-worktrees",
      },
      { name: "exempt", says: "branches the naming scheme does not apply to: names, or patterns with *", default: "[]" },
      {
        name: "resources",
        says:
          'what one branch at a time may hold — resource name → { "says": "<what it is>", "role": "<the role that holds it>" } — taken with naima claim --resource <name>',
        default: "{}",
      },
    ],
    dirs: [CLAIMS, PASSES, EVENTS],
    checks: [claimsResolve, resourcesOneHolder(declared), worktreePolicy(policy), trunkMoved, closedNotClaimed, sessionNoteAck],
    commands: [openCommand(policy), claimCommand(declared), release, claimsCommand(declared), prune, pass, eventCommand, diaryCommand(readPasses)],
    views: [timelineView(readPasses)],
    contributes: { "ui-views": [claimsUiView(claimsData), timelineUiView(readPasses), notesUiView(readPasses)] },
    // The claims are a panel of naima ui, the timeline and the session notes tabs, when the ui plugin is loaded; without it, still commands and a view.
    optional: ["ui-views"],
    summary: [whereWeWere, inHand],
    hooks: [noClosingOwnWork],
  }
}
