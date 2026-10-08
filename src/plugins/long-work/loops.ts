// Hand-written waits, found in text: a process lookup by pattern (`pgrep -f`,
// `pkill -f`, which match their own command line) and a `while`/`until` loop
// whose body sleeps. What the check `wait-loops` reports
// (specs/long-work-naima-run-wait-run-list, §5).

/** A line that carries this, or follows one that does, is exempt: the reason is written after it. */
export const ALLOW = "naima: allow-wait-loop"

export interface Wait {
  /** 1-based. */
  line: number
  what: "pattern lookup" | "sleep loop"
  text: string
}

const PATTERN = /\bp(?:grep|kill)\b(?:\s+-[A-Za-z0-9]+)*\s+-[A-Za-z]*f/
const LOOP = /(?:^|[;&|({`]\s*|\b(?:then|do|else)\s+)(?:while|until)\b/
const word = (w: string) => new RegExp(`(?:^|[\\s;&|()])${w}(?=$|[\\s;&|()])`, "g")
const DO = word("do")
const DONE = word("done")
const SLEEP = /\bsleep\b/

const comment = (line: string): boolean => /^\s*#/.test(line)

/** Every hand-written wait in `text`, in order. */
export function findWaits(text: string): Wait[] {
  const lines = text.split(/\r?\n/)
  const allowed = (i: number): boolean => (lines[i] ?? "").includes(ALLOW) || (i > 0 && (lines[i - 1] ?? "").includes(ALLOW))
  const out: Wait[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ""
    if (comment(line) || allowed(i)) continue
    if (PATTERN.test(line)) out.push({ line: i + 1, what: "pattern lookup", text: line.trim() })
    if (!LOOP.test(line)) continue
    // The loop's body: from its line to the `done` that closes it, nested loops counted.
    let depth = 0
    let opened = false
    let body = ""
    for (let j = i; j < lines.length && j < i + 200; j++) {
      const l = comment(lines[j] ?? "") ? "" : lines[j] ?? ""
      body += l + "\n"
      depth += (l.match(DO) ?? []).length
      if ((l.match(DO) ?? []).length) opened = true
      depth -= (l.match(DONE) ?? []).length
      if (opened && depth <= 0) break
    }
    if (SLEEP.test(body)) out.push({ line: i + 1, what: "sleep loop", text: line.trim() })
  }
  return out
}

/** The tracked files the check reads: shell scripts, by their extension. */
export const SCRIPT = /\.(?:sh|bash|zsh|ksh)$/
