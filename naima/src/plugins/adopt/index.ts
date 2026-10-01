// Adopting a board a project already keeps — a TODO.md, a notes file, an
// issue list exported as markdown — as items, without losing a line of it.
// It runs in phases, each a dry run until `--write`:
//
//   propose   boundary markers, one pair around each top-level list item,
//             inserted as HTML comments: the diff adds lines and deletes none
//   split     one item per marked segment, its page the segment byte for byte;
//             the rest is the board's own prose, kept in a record beside the items
//   audit     every committed version of the source re-read, and each line that
//             no item and no board prose carries reported
//   links     links proposed only on hard evidence: a real commit both items
//             name and shared wording; everything else printed for a person
//
// The source is never deleted, emptied or rewritten: `propose --write` only
// inserts marker lines, and nothing else here writes it.

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"
import {
  addLink,
  bool,
  type Command,
  type Context,
  CONTRACT,
  createItem,
  type FieldDef,
  gitPath,
  type Item,
  label,
  NaimaError,
  parse,
  type Plugin,
  readReadme,
  runGit,
  saveProse,
  slugify,
  typeOrThrow,
  uniqueSlug,
  usageError,
  writeFileAtomic,
  writeJson,
} from "../../core/api.ts"

/** The directory under the tracker root that holds one adoption record per source file. */
export const ADOPTED = "adopted"

const OPEN = /^<!-- naima: ([a-z][\w-]*)((?: [A-Za-z]+=\S+)*) -->\r?\n?$/
const CLOSE = /^<!-- \/naima -->\r?\n?$/
const LIST_START = /^(?:[-*+]|\d+[.)])[ \t]+\S/
const FENCE = /^(```|~~~)/
const HEADING = /^#{1,6}[ \t]+(.*?)[ \t#]*\r?\n?$/

const ADOPTED_FROM: FieldDef = {
  name: "adoptedFrom",
  kind: "string",
  says:
    "where an adopted item came from: the source file, its lines, and the commit it was read at (`TODO.md#L8-L9@<commit>`), or `working-tree` when uncommitted",
}

/** A file cut into lines, each with its own line ending: joined, they are the file byte for byte. */
const linesOf = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/g) ?? []
const bare = (line: string): string => line.replace(/\r?\n$/, "")
const isMarker = (line: string): boolean => OPEN.test(line) || CLOSE.test(line)
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex")

/** The text without its marker lines: the source as it was before `propose --write`. */
export const stripMarkers = (text: string): string => linesOf(text).filter((l) => !isMarker(l)).join("")

/** A list item's title: its first line, without the bullet, the checkbox and the emphasis marks. */
function titleOf(line: string): string {
  const t = bare(line)
    .replace(/^(?:[-*+]|\d+[.)])[ \t]+/, "")
    .replace(/^\[[ xX]\][ \t]*/, "")
    .replace(/\*\*|__|~~/g, "")
    .trim()
  return t.length > 100 ? `${t.slice(0, 99).trimEnd()}…` : t
}

/** One marker `propose` would insert. */
export interface Proposed {
  /** The list item's line in the text it was proposed on, from 1. */
  line: number
  type: string
  key: string
  status?: string
  title: string
}

const BUGGY = /\b(bug|broken|crash(es|ed)?|fails?|failing|error)\b/i

/**
 * Markers around every top-level list item not already inside a marked
 * segment: an opening marker before it, a closing one after its last indented
 * line, none at the end of a file with no final newline. Only lines are added.
 */
export function proposeMarkers(text: string): { text: string; markers: Proposed[] } {
  const lines = linesOf(text)
  const eol = text.includes("\r\n") ? "\r\n" : "\n"
  const inside: boolean[] = []
  const taken = new Set<string>()
  let open = false
  for (const l of lines) {
    const m = OPEN.exec(l)
    if (m) {
      open = true
      const key = / key=(\S+)/.exec(m[2] ?? "")?.[1]
      if (key) taken.add(key)
    } else if (CLOSE.test(l)) open = false
    inside.push(open || isMarker(l))
  }
  const out: string[] = []
  const markers: Proposed[] = []
  let fenced = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!inside[i] && FENCE.test(line)) fenced = !fenced
    if (inside[i] || fenced || !LIST_START.test(line)) {
      out.push(line)
      continue
    }
    let last = i
    for (let k = i + 1; k < lines.length; k++) {
      const l = lines[k]!
      if (inside[k]) break
      if (!bare(l).trim()) continue
      if (/^[ \t]/.test(l)) last = k
      else break
    }
    const title = titleOf(line)
    const ticked = /^(?:[-*+]|\d+[.)])[ \t]+\[[xX]\]/.test(line)
    const type = ticked || !BUGGY.test(title) ? "todos" : "bugs"
    const key = uniqueSlug(slugify(title), taken)
    taken.add(key)
    markers.push({ line: i + 1, type, key, ...(ticked ? { status: "done" } : {}), title })
    out.push(`<!-- naima: ${type} key=${key}${ticked ? " status=done" : ""} -->${eol}`)
    for (let k = i; k <= last; k++) out.push(lines[k]!)
    if (lines[last]!.endsWith("\n")) out.push(`<!-- /naima -->${eol}`)
    i = last
  }
  return { text: out.join(""), markers }
}

/** One marked segment: what becomes one item. */
export interface Segment {
  type: string
  key: string
  attrs: Record<string, string>
  /** The lines between the markers, byte for byte. */
  text: string
  /** Its first and last line in the marked file, from 1. */
  from: number
  to: number
  /** The nearest heading above it, or none. */
  section: string | null
  title: string
}

export type Piece = { prose: string } | { segment: number }

/** A marked file cut into the board's own prose and its segments, in order: joined, they are `stripMarkers(text)`. */
export function splitMarked(text: string): { pieces: Piece[]; segments: Segment[] } {
  const pieces: Piece[] = []
  const segments: Segment[] = []
  let prose = ""
  let current: Segment | null = null
  let section: string | null = null
  const flush = () => {
    if (prose) pieces.push({ prose })
    prose = ""
  }
  const end = () => {
    if (current && current.text) {
      segments.push(current)
      pieces.push({ segment: segments.length - 1 })
    }
    current = null
  }
  linesOf(text).forEach((line, i) => {
    const m = OPEN.exec(line)
    if (m) {
      end()
      flush()
      const attrs = Object.fromEntries([...(m[2] ?? "").matchAll(/ ([A-Za-z]+)=(\S+)/g)].map((a) => [a[1]!, a[2]!]))
      current = { type: m[1]!, key: attrs["key"] ?? "", attrs, text: "", from: i + 2, to: i + 1, section, title: "" }
      return
    }
    if (CLOSE.test(line)) return end()
    const seg = current as Segment | null
    if (seg) {
      if (!seg.text) seg.title = titleOf(line)
      seg.text += line
      seg.to = i + 1
      return
    }
    const h = HEADING.exec(line)
    if (h) section = h[1]!.trim() || section
    prose += line
  })
  end()
  flush()
  for (const s of segments) if (!s.key) s.key = slugify(s.title)
  return { pieces, segments }
}

/** What `split` keeps beside the items: enough to give the source back, and to know on a re-run what is already adopted. */
interface Adoption {
  source: string
  /** The commit the source was last read at, or `working-tree`. */
  at: string
  /** sha256 of the source without its markers. */
  sha256: string
  items: Record<string, { id: string; sha256: string }>
  /** The board's prose and each adopted segment's text as it was adopted, in order. */
  pieces: ({ prose: string } | { key: string; item: string; text: string })[]
}

interface Source {
  abs: string
  rel: string
  text: string
}

function sourceOf(ctx: Context, arg: string): Source {
  const abs = resolve(ctx.root, arg)
  const rel = relative(ctx.root, abs)
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new NaimaError(`${arg} is outside the project — adopt reads a file inside ${ctx.root}`)
  if (!existsSync(abs)) throw new NaimaError(`no file ${gitPath(rel)}`)
  return { abs, rel: gitPath(rel), text: readFileSync(abs, "utf8") }
}

const recordPath = (ctx: Context, rel: string): string => join(ctx.trackerRoot, ADOPTED, `${slugify(rel, 20)}.json`)

function readRecord(ctx: Context, rel: string): Adoption | null {
  const path = recordPath(ctx, rel)
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Adoption) : null
}

/** The commit the file was read at: HEAD's, when the file is committed and unchanged there; else `working-tree`. */
function readAt(ctx: Context, rel: string): string {
  const tracked = runGit(ctx.root, ["ls-files", "--error-unmatch", "--", rel]).ok
  const clean = tracked && runGit(ctx.root, ["diff", "--quiet", "HEAD", "--", rel]).ok
  const head = clean ? runGit(ctx.root, ["rev-parse", "HEAD"]) : null
  return head?.ok ? head.out.slice(0, 12) : "working-tree"
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** How many lines of `before` are not kept, in order, in `after`: zero when `after` only adds lines. */
function deletedLines(before: string, after: string): number {
  const was = linesOf(before)
  let k = 0
  for (const l of linesOf(after)) if (k < was.length && l === was[k]) k++
  return was.length - k
}

function propose(ctx: Context, src: Source, write: boolean): number {
  const { text, markers } = proposeMarkers(src.text)
  const deleted = deletedLines(src.text, text)
  // The one write to a source file there is: refused unless the markers are all it adds.
  if (deleted || stripMarkers(text) !== stripMarkers(src.text)) {
    throw new Error(`adopt: the proposed markers would change ${src.rel} beyond adding lines — a bug in adopt, nothing written`)
  }
  ctx.out(`${src.rel}: ${plural(markers.length, "marker")} proposed, ${deleted} lines deleted`)
  for (const m of markers) ctx.out(`  + L${m.line}  ${m.type}${m.status ? ` (${m.status})` : ""}  ${m.key}  ${m.title}`)
  if (!markers.length) return 0
  if (!write) {
    ctx.out(`dry run: nothing written — naima adopt propose ${src.rel} --write inserts them; review the diff, then naima adopt split ${src.rel}`)
    return 0
  }
  writeFileAtomic(src.abs, text)
  ctx.out(
    `wrote ${
      plural(markers.length, "marker")
    } into ${src.rel}: review the diff (git diff ${src.rel}); change a marker's type, key or status by hand, then naima adopt split ${src.rel}`,
  )
  return 0
}

function split(ctx: Context, src: Source, write: boolean): number {
  const { pieces, segments } = splitMarked(src.text)
  if (!segments.length) throw new NaimaError(`no markers in ${src.rel} — run naima adopt propose ${src.rel} first`)
  const record = readRecord(ctx, src.rel)
  const known = record?.items ?? {}
  const byId = new Map(ctx.repo.items.map((i) => [i.meta.id, i]))
  const keys = new Set<string>()
  for (const s of segments) {
    if (keys.has(s.key)) throw new NaimaError(`${src.rel} L${s.from - 1}: key ${s.key} is used twice — give one marker another key`)
    keys.add(s.key)
    const type = typeOrThrow(ctx, s.type)
    if (type.creatable === false) throw new NaimaError(`${src.rel} L${s.from - 1}: ${s.type} items cannot be opened — pick another type`)
    const status = s.attrs["status"]
    if (status && !(status in type.statuses)) {
      throw new NaimaError(`${src.rel} L${s.from - 1}: ${status} is not a status of ${s.type} — one of ${Object.keys(type.statuses).join(", ")}`)
    }
  }
  const fresh = segments.filter((s) => !known[s.key])
  const notes: string[] = []
  for (const s of segments) {
    const had = known[s.key]
    if (!had) continue
    if (!byId.has(had.id)) notes.push(`  ${s.key}: adopted as ${had.id}, no longer in the tracker; not reopened`)
    else if (had.sha256 !== sha256(s.text)) notes.push(`  ${s.key}: changed in the source since it was adopted; the item is not overwritten`)
  }
  const kept = segments.length - fresh.length
  if (!write) {
    ctx.out(`${src.rel}: would open ${plural(fresh.length, "item")}, ${kept} already adopted`)
    for (const s of fresh) ctx.out(`  + ${s.type}  ${s.key}  L${s.from}-L${s.to}  ${s.title}${s.section ? `  (section ${s.section})` : ""}`)
    for (const n of notes) ctx.out(n)
    ctx.out(`dry run: nothing written — naima adopt split ${src.rel} --write opens them`)
    return 0
  }
  const at = readAt(ctx, src.rel)
  const items: Adoption["items"] = { ...known }
  const opened: Item[] = []
  for (const s of fresh) {
    const lines = s.from === s.to ? `L${s.from}` : `L${s.from}-L${s.to}`
    const fields: Record<string, unknown> = { [ADOPTED_FROM.name]: `${src.rel}#${lines}@${at}`, ...(s.section ? { section: s.section } : {}) }
    if (s.attrs["status"]) fields["status"] = s.attrs["status"]
    const item = createItem(ctx, typeOrThrow(ctx, s.type), s.title || s.key, fields)
    saveProse(ctx, item, `# ${item.meta.title}\n\n${s.text}`)
    items[s.key] = { id: item.meta.id, sha256: sha256(s.text) }
    opened.push(item)
  }
  const previous = new Map((record?.pieces ?? []).flatMap((p) => ("key" in p ? [[p.key, p.text] as const] : [])))
  const adoption: Adoption = {
    source: src.rel,
    at,
    sha256: sha256(stripMarkers(src.text)),
    items,
    pieces: pieces.map((p) => {
      if ("prose" in p) return p
      const s = segments[p.segment]!
      // A segment adopted earlier keeps the text it was adopted with: the record never overwrites either.
      return { key: s.key, item: items[s.key]!.id, text: previous.get(s.key) ?? s.text }
    }),
  }
  writeJson(recordPath(ctx, src.rel), adoption)
  ctx.out(`${src.rel}: opened ${plural(opened.length, "item")}, ${kept} already adopted`)
  for (const i of opened) ctx.out(`  + ${label(i)}  ${String(i.meta[ADOPTED_FROM.name])}`)
  for (const n of notes) ctx.out(n)
  ctx.out(`next: naima adopt audit ${src.rel}, then naima adopt links ${src.rel}; ${src.rel} stays where it is`)
  return 0
}

/** Every committed version of the file, oldest first, following renames: commit and path. */
function versions(ctx: Context, rel: string): { commit: string; path: string }[] {
  const r = runGit(ctx.root, ["log", "--follow", "--format=%H", "--name-only", "--", rel])
  if (!r.ok) return []
  const out: { commit: string; path: string }[] = []
  for (const line of r.out.split("\n")) {
    if (/^[0-9a-f]{40}$/.test(line)) out.push({ commit: line, path: rel })
    else if (line.trim() && out.length) out[out.length - 1]!.path = line.trim()
  }
  return out.reverse()
}

const meaningful = (line: string): string | null => {
  const t = bare(line).trim()
  return t && !isMarker(line) ? t : null
}

function audit(ctx: Context, src: Source): number {
  const record = readRecord(ctx, src.rel)
  const carried = new Set<string>()
  const carry = (text: string) => linesOf(text).forEach((l) => void (meaningful(l) && carried.add(meaningful(l)!)))
  for (const p of record?.pieces ?? []) carry("prose" in p ? p.prose : p.text)
  for (const i of ctx.repo.items) carry(readReadme(i))
  const read: { name: string; text: string }[] = []
  for (const v of versions(ctx, src.rel)) {
    const shown = runGit(ctx.root, ["show", `${v.commit}:${v.path}`])
    if (shown.ok) read.push({ name: v.commit.slice(0, 12), text: shown.out })
  }
  const committed = read.length
  if (readAt(ctx, src.rel) === "working-tree") read.push({ name: "working tree", text: src.text })
  const missing: string[] = []
  const seen = new Set<string>()
  for (const v of read) {
    linesOf(v.text).forEach((l, i) => {
      const t = meaningful(l)
      if (!t || carried.has(t) || seen.has(t)) return
      seen.add(t)
      missing.push(`  ${v.name} L${i + 1}: ${t}`)
    })
  }
  ctx.out(`${src.rel}: ${plural(committed, "version")} read from git${read.length > committed ? ", and the working tree" : ""}`)
  if (missing.length) {
    ctx.out(`not carried over (${plural(missing.length, "line")}) — adopt them (naima adopt propose ${src.rel}), or carry each into an item by hand:`)
    for (const m of missing) ctx.out(m)
  } else ctx.out("nothing missing: every line of every version is in an item or in the board's prose")
  if (record) {
    const rebuilt = record.pieces.map((p) => ("prose" in p ? p.prose : p.text)).join("")
    const now = stripMarkers(src.text)
    ctx.out(
      rebuilt === now
        ? "round trip: the board's prose and the items' prose give the source back byte for byte"
        : `round trip: the source has changed since it was adopted (sha256 ${record.sha256.slice(0, 12)} then, ${sha256(now).slice(0, 12)} now)`,
    )
    const byId = new Map(ctx.repo.items.map((i) => [i.meta.id, i]))
    for (const p of record.pieces) {
      if (!("key" in p)) continue
      const item = byId.get(p.item)
      if (!item) ctx.out(`  ${p.key}: its item ${p.item} is no longer in the tracker; its adopted text is in the record`)
      else if (!readReadme(item).includes(p.text)) ctx.out(`  ${label(item)}: edited since it was adopted; its adopted text is in the record`)
    }
  } else ctx.out(`not adopted yet: naima adopt split ${src.rel}`)
  return missing.length ? 1 : 0
}

const MORE_STOP = new Set([
  "also",
  "after",
  "before",
  "from",
  "into",
  "that",
  "this",
  "then",
  "than",
  "when",
  "were",
  "have",
  "been",
  "does",
  "done",
  "which",
  "here",
  "there",
  "with",
  "without",
  "should",
  "would",
  "could",
])
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g
const HASH = /\b[0-9a-f]{7,40}\b/g
const hexish = (w: string): boolean => /^[0-9a-f]{7,40}$/.test(w) && /\d/.test(w)

/** The words two titles must share to count as shared wording: four letters or more, not too common, not a hash. */
const wordsOf = (title: string): Set<string> =>
  new Set(title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !MORE_STOP.has(w) && !hexish(w) && !/^\d+$/.test(w)))

function commitsIn(ctx: Context, text: string, cache: Map<string, string | null>): Set<string> {
  const out = new Set<string>()
  for (const h of text.replace(UUID, " ").match(HASH) ?? []) {
    if (!cache.has(h)) {
      const r = runGit(ctx.root, ["rev-parse", "--verify", "--quiet", `${h}^{commit}`])
      cache.set(h, r.ok ? r.out.trim() : null)
    }
    const full = cache.get(h)
    if (full) out.add(full)
  }
  return out
}

/** The shell commands in an item's fenced `sh` blocks: candidates for a gate, never proposed as one. */
function commandsIn(text: string): string[] {
  const out: string[] = []
  let shell: boolean | null = null
  for (const line of linesOf(text).map((l) => bare(l).trim())) {
    const fence = /^(```|~~~)\s*(\w*)/.exec(line)
    if (fence) {
      shell = shell === null ? ["sh", "bash", "shell", "zsh", "console"].includes(fence[2] ?? "") : null
      continue
    }
    if (shell && line && !line.startsWith("#")) out.push(line.replace(/^\$ /, ""))
  }
  return out
}

function links(ctx: Context, src: Source, write: boolean): number {
  const record = readRecord(ctx, src.rel)
  if (!record) throw new NaimaError(`${src.rel} is not adopted yet — naima adopt split ${src.rel} --write first`)
  const byId = new Map(ctx.repo.items.map((i) => [i.meta.id, i]))
  const mine = Object.values(record.items).flatMap((r) => (byId.has(r.id) ? [byId.get(r.id)!] : []))
  const mineIds = new Set(mine.map((i) => i.meta.id))
  const cache = new Map<string, string | null>()
  const facts = new Map(
    ctx.repo.items.map((i) => {
      const fixed = i.meta["fixedOn"]
      const text = `${String(i.meta.title)}\n${readReadme(i)}\n${Array.isArray(fixed) ? fixed.join(" ") : typeof fixed === "string" ? fixed : ""}`
      return [i.meta.id, { commits: commitsIn(ctx, text, cache), words: wordsOf(String(i.meta.title)) }] as const
    }),
  )
  const proposed: { from: Item; to: Item; why: string }[] = []
  const decide: string[] = []
  const seenPairs = new Set<string>()
  for (const a of mine) {
    const fa = facts.get(a.meta.id)!
    const linked = new Set(ctx.repo.linksOf(a).map((l) => l.id))
    for (const b of ctx.repo.items) {
      if (b.meta.id === a.meta.id || linked.has(b.meta.id)) continue
      const pair = [a.meta.id, b.meta.id].sort().join(" ")
      if (seenPairs.has(pair)) continue
      seenPairs.add(pair)
      const fb = facts.get(b.meta.id)!
      const commits = [...fa.commits].filter((c) => fb.commits.has(c))
      const words = [...fa.words].filter((w) => fb.words.has(w))
      const [from, to] = mineIds.has(b.meta.id) && mine.indexOf(b) < mine.indexOf(a) ? [b, a] : [a, b]
      const pairName = `${label(from)} ~ ${label(to)}`
      const commitText = commits.map((c) => c.slice(0, 12)).join(", ")
      if (commits.length && words.length >= 2) proposed.push({ from, to, why: `commit ${commitText}, words: ${words.join(", ")}` })
      else if (commits.length) decide.push(`  ${pairName}: shared commit, no shared wording (commit ${commitText})`)
      else if (words.length >= 2) decide.push(`  ${pairName}: shared wording, no shared commit (${words.join(", ")})`)
    }
  }
  for (const a of mine) for (const c of commandsIn(readReadme(a))) decide.push(`  gate? \`${c}\` (${label(a)})`)
  ctx.out(`${src.rel}: links from hard evidence only — a real commit both items name, and at least two words their titles share`)
  ctx.out(`Proposed (${proposed.length}):`)
  for (const p of proposed) ctx.out(`  naima link ${label(p.from)} relates-to ${label(p.to)}   — ${p.why}`)
  ctx.out(`For a person to decide (${decide.length}): nothing here is written`)
  for (const d of decide) ctx.out(d)
  if (!write) {
    if (proposed.length) ctx.out(`dry run: no link written — naima adopt links ${src.rel} --write writes the proposed ones`)
    return 0
  }
  for (const p of proposed) if (addLink(ctx, p.from, "relates-to", p.to)) ctx.out(`linked ${label(p.from)} relates-to ${label(p.to)}`)
  return 0
}

const command: Command = {
  name: "adopt",
  says:
    "adopt a board the project already keeps (a TODO.md, an issue list in markdown) as items, without losing a line: propose markers, split, audit, links — each a dry run until --write; the source is never deleted",
  usage: "adopt <propose|split|audit|links> <file> [--write]",
  options: [{ name: "--write", says: "with propose, split or links: do it, instead of printing what would be done" }],
  examples: ["adopt propose TODO.md", "adopt propose TODO.md --write", "adopt split TODO.md --write", "adopt audit TODO.md", "adopt links TODO.md"],
  run(args, ctx) {
    const p = parse(args, { write: { type: "boolean" } })
    const [sub, file, ...rest] = p.positionals
    if (!sub || !file || rest.length || !["propose", "split", "audit", "links"].includes(sub)) throw usageError(this)
    const write = bool(p, "write")
    if (sub === "audit" && write) throw usageError(this)
    const src = sourceOf(ctx, file)
    if (sub === "propose") return propose(ctx, src, write)
    if (sub === "split") return split(ctx, src, write)
    if (sub === "audit") return audit(ctx, src)
    return links(ctx, src, write)
  },
}

export default function adopt(): Plugin {
  return {
    name: "adopt",
    contract: CONTRACT,
    says: "adopt a board the project already keeps as items, in reviewed phases, without losing a line of it or deleting it",
    about:
      "`naima adopt` brings an existing board — a TODO.md, a notes file, an issue list in markdown — into the tracker without retyping it, in phases that are each a dry run until `--write`. " +
      "`propose` inserts a pair of HTML-comment markers around each top-level list item (`<!-- naima: todos key=<key> -->` … `<!-- /naima -->`), with a type, a key and, for a ticked checkbox, `status=done`: the diff adds lines and deletes none, and a person reviews and edits the markers before anything else. " +
      "`split` opens one item per marked segment; its page is the segment byte for byte under a title line, `section` is the nearest heading, and `adoptedFrom` says the file, the lines and the commit. " +
      `The board's own prose — headings, paragraphs, everything between segments — is kept in \`${ADOPTED}/<file>.json\` with each segment's text as adopted, so the source comes back byte for byte. ` +
      "A re-run opens only segments whose key is not adopted yet, and never overwrites an item or the text it was adopted with. " +
      "`audit` re-reads every committed version of the source, following renames, and lists each line that no item and no board prose carries — a todo deleted before adoption is found in its old commit. " +
      "`links` proposes `relates-to` only on hard evidence: a real commit both items name and at least two words their titles share; a shared commit alone, shared wording alone, and commands in fenced shell blocks (gate candidates) are printed for a person to decide. " +
      "Nothing here deletes or empties the source: `propose --write` only inserts marker lines.",
    fields: [ADOPTED_FROM],
    dirs: [ADOPTED],
    commands: [command],
  }
}
