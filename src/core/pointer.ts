// The agent-harness entry-point check, and the one-line pointer `naima init`
// may write. Each agent tool reads its own always-on file (CLAUDE.md,
// AGENTS.md, …), mostly to point at the rulebook; if the pointer names a file
// that no longer exists, nothing errors — the agent is simply taught
// nothing. `naima check` reports any such broken reference in a configured
// entry file; `naima init --write-agent-pointer` (opt-in) writes the one line
// that says where Naima is into the host's AGENTS.md, else its CLAUDE.md,
// else a new AGENTS.md (features/agent-harness-entry-point-check-naima-init).

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { posixRelative } from "./config.ts"

/** The harness entry files a project is checked against, absent its own `entryFiles` in naima.json. */
export const DEFAULT_ENTRY_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".github/copilot-instructions.md", "GEMINI.md"] as const

/** One path or link an entry file names, naming a missing file. */
export interface BrokenLink {
  file: string
  target: string
}

/** `text` with every markdown link already matched blanked out, so a link's own target is not also read as a bare path. */
function blank(text: string, spans: readonly (readonly [number, number])[]): string {
  const chars = [...text]
  for (const [s, e] of spans) for (let i = s; i < e; i++) chars[i] = " "
  return chars.join("")
}

/** Every markdown-link target and bare relative-path-looking token in `text`, in the order they appear. */
function linksIn(text: string): string[] {
  const out: string[] = []
  const spans: [number, number][] = []
  for (const m of text.matchAll(/\[[^\]]*]\(([^)\s]+)\)/g)) {
    out.push(m[1] as string)
    spans.push([m.index as number, (m.index as number) + m[0].length])
  }
  const rest = blank(text, spans)
  for (const m of rest.matchAll(/(?<![\w./-])(\.{1,2}\/[\w.-]+(?:\/[\w.-]+)*|[\w-]+(?:\/[\w.-]+)+\.(?:md|ts|js|json|txt))(?![\w./-])/g)) {
    out.push(m[1] as string)
  }
  return out
}

/** `target` as a local path to resolve, or null when it is a URL (any `scheme:`, including `mailto:`) or a bare in-page anchor. */
function localTarget(target: string): string | null {
  const t = target.split("#")[0]?.trim()
  if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t)) return null
  return t
}

/** Every link or plain-text path, in `root`'s configured entry files that exist, naming a file missing from disk. */
export function brokenEntryLinks(root: string, entryFiles: readonly string[]): BrokenLink[] {
  const out: BrokenLink[] = []
  for (const file of entryFiles) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const dir = dirname(path)
    for (const raw of linksIn(readFileSync(path, "utf8"))) {
      const target = localTarget(raw)
      if (!target || existsSync(resolve(dir, target))) continue
      out.push({ file, target: raw })
    }
  }
  return out
}

/** The entry files the pointer is written into, in order: the first that exists, else the first, created. */
export const POINTER_FILES = ["AGENTS.md", "CLAUDE.md"] as const

/** What every pointer says, wherever its tracker folder is: how an entry file is known to hold one. */
const POINTER_MARK = "(naima/ the program, naima-data/ the data)"

/** The one line that tells agents where Naima is: the tracker folder, from the project root. */
export function pointerLine(root: string, tracker: string): string {
  return `Naima is in ${posixRelative(root, tracker)}/ ${POINTER_MARK}; if you find it elsewhere, update this line.`
}

/** Whether `entryFile` already says where Naima is, or links Naima's agent docs as an earlier pointer did. */
function hasPointer(root: string, entryFile: string): boolean {
  const path = join(root, entryFile)
  if (!existsSync(path)) return false
  const text = readFileSync(path, "utf8")
  return text.includes(POINTER_MARK) || linksIn(text).some((raw) => /(^|\/)naima\/docs\/agents\/README\.md$/.test(localTarget(raw) ?? ""))
}

export interface EntryPointer {
  /** The entry file the pointer is in, or would be written into. */
  file: string
  line: string
  /** One of the entry files already has it. */
  present: boolean
}

/** The pointer: present when any configured entry file (or AGENTS.md, CLAUDE.md) has it; else the file it would be written into. */
export function agentPointer(root: string, tracker: string, entryFiles: readonly string[]): EntryPointer {
  const line = pointerLine(root, tracker)
  const holder = [...new Set([...POINTER_FILES, ...entryFiles])].find((f) => hasPointer(root, f))
  if (holder) return { file: holder, line, present: true }
  return { file: POINTER_FILES.find((f) => existsSync(join(root, f))) ?? POINTER_FILES[0], line, present: false }
}

/** Append the pointer line to `entryFile`, under a blank line, creating the file when it does not exist. */
export function writePointer(root: string, tracker: string, entryFile: string): void {
  const path = join(root, entryFile)
  const text = existsSync(path) ? readFileSync(path, "utf8") : ""
  const line = pointerLine(root, tracker)
  writeFileSync(path, text + (text && !text.endsWith("\n") ? "\n" : "") + (text.trim() ? "\n" : "") + line + "\n")
}
