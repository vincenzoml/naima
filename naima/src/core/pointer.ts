// The agent-harness entry-point check, and the one-line pointer `naima init`
// may write. Each agent tool reads its own always-on file (CLAUDE.md,
// AGENTS.md, …), mostly to point at the rulebook; if the pointer names a file
// that no longer exists, nothing errors — the agent is simply taught
// nothing. `naima check` reports any such broken reference in a configured
// entry file; `naima init --write-agent-pointer` (opt-in) writes a line
// pointing at Naima's own agent docs into each one that lacks it
// (features/agent-harness-entry-point-check-naima-init).

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

/** The one-line pointer at Naima's own agent docs, relative to `entryFile`'s own directory. */
export function pointerLine(root: string, program: string, entryFile: string): string {
  const target = posixRelative(dirname(join(root, entryFile)), join(program, "docs/agents/README.md"))
  return `Read [${target}](${target}) before anything else: it holds Naima's rules for agents.`
}

/** Whether `entryFile` already links to Naima's own agent docs, wherever it names them from. */
function hasPointer(root: string, program: string, entryFile: string): boolean {
  const path = join(root, entryFile)
  if (!existsSync(path)) return false
  const docs = resolve(program, "docs/agents/README.md")
  const dir = dirname(path)
  return linksIn(readFileSync(path, "utf8")).some((raw) => {
    const target = localTarget(raw)
    return target !== null && resolve(dir, target) === docs
  })
}

export interface EntryPointer {
  file: string
  line: string
  /** Already points at Naima's own agent docs. */
  present: boolean
  /** The file exists, so the pointer can be appended to it. */
  writable: boolean
}

/** Every configured entry file that exists, with the pointer line it already has or would gain. */
export function entryPointers(root: string, program: string, entryFiles: readonly string[]): EntryPointer[] {
  return entryFiles
    .filter((file) => existsSync(join(root, file)))
    .map((file) => ({ file, line: pointerLine(root, program, file), present: hasPointer(root, program, file), writable: true }))
}

/** Append the pointer line to `entryFile`, under a blank line, unless it is already there. */
export function writePointer(root: string, program: string, entryFile: string): void {
  const path = join(root, entryFile)
  const text = readFileSync(path, "utf8")
  const line = pointerLine(root, program, entryFile)
  writeFileSync(path, text + (text.endsWith("\n") ? "" : "\n") + (text.trim() ? "\n" : "") + line + "\n")
}
