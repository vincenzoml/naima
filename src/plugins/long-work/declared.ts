// Long work declared without progress: what the check `progress-declared`
// reads (specs/progress-long-work-says-how-far, §7). A shell script is read
// as shell words — quotes, escapes and line continuations — and split into
// simple commands at the shell's operators; a `naima run` among them is
// found by its words, never by a pattern over the line.

/** One `naima run` that starts a run, as a script writes it. */
export interface ScriptRun {
  /** 1-based: the line it starts on. */
  line: number
  /** The run's own words, between `run` and `--`. */
  options: string[]
  /** The words after `--`: the command. */
  command: string[]
}

const OPERATORS = ["&&", "||", ";;", ";", "&", "|", "(", ")"]

/** The words of one shell line, in order, with each operator a word of its own; a comment ends the line. */
export function shellWords(line: string): { words: string[]; ops: Set<number> } {
  const words: string[] = []
  const ops = new Set<number>()
  let word: string | null = null
  const push = (): void => {
    if (word !== null) words.push(word)
    word = null
  }
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (c === "\\" && i + 1 < line.length) {
      word = (word ?? "") + line[++i]
    } else if (c === "'") {
      const end = line.indexOf("'", i + 1)
      const to = end < 0 ? line.length : end
      word = (word ?? "") + line.slice(i + 1, to)
      i = to
    } else if (c === '"') {
      let j = i + 1
      let inner = ""
      while (j < line.length && line[j] !== '"') {
        if (line[j] === "\\" && j + 1 < line.length && '"\\$`'.includes(line[j + 1]!)) j++
        inner += line[j]
        j++
      }
      word = (word ?? "") + inner
      i = j
    } else if (c === "#" && word === null) {
      break
    } else if (/\s/.test(c)) {
      push()
    } else {
      const op = OPERATORS.find((o) => line.startsWith(o, i))
      if (op) {
        push()
        ops.add(words.length)
        words.push(op)
        i += op.length - 1
      } else word = (word ?? "") + c
    }
  }
  push()
  return { words, ops }
}

/** Whether `word` invokes Naima: `naima`, a path to it, or its launcher `naima.ts`. */
const isNaima = (word: string): boolean => {
  const base = word.split(/[\\/]/).pop() ?? word
  return base === "naima" || base === "naima.ts"
}

/** The Naima command a simple command runs, with its arguments: null when it runs none. */
export function naimaCommand(words: string[]): { name: string; args: string[] } | null {
  const at = words.findIndex(isNaima)
  if (at < 0 || at + 1 >= words.length) return null
  // Options a launcher takes before the command (`naima --data <dir> run …`) are skipped with their values.
  let i = at + 1
  while (i < words.length && words[i]!.startsWith("-")) i += words[i]!.includes("=") ? 1 : 2
  const name = words[i]
  return name === undefined ? null : { name, args: words.slice(i + 1) }
}

/** The simple commands of a line: its words, cut at the operators. */
function simpleCommands(line: string): string[][] {
  const { words, ops } = shellWords(line)
  const out: string[][] = [[]]
  words.forEach((w, i) => (ops.has(i) ? out.push([]) : out[out.length - 1]!.push(w)))
  return out.filter((c) => c.length)
}

/** Every `naima run` that starts a run in `text`, a shell script; `subcommands` are the words after `run` that start none. */
export function findRuns(text: string, subcommands: readonly string[]): ScriptRun[] {
  const lines = text.split(/\r?\n/)
  const out: ScriptRun[] = []
  for (let i = 0; i < lines.length; i++) {
    const first = i
    let logical = lines[i] ?? ""
    while (/\\$/.test(logical) && i + 1 < lines.length) logical = logical.slice(0, -1) + " " + (lines[++i] ?? "")
    for (const words of simpleCommands(logical)) {
      const cmd = naimaCommand(words)
      if (!cmd || cmd.name !== "run" || !cmd.args.length || subcommands.includes(cmd.args[0]!)) continue
      const dash = cmd.args.indexOf("--")
      out.push({ line: first + 1, options: dash < 0 ? cmd.args : cmd.args.slice(0, dash), command: dash < 0 ? [] : cmd.args.slice(dash + 1) })
    }
  }
  return out
}

/** The reason a run's options give with --no-progress, or undefined. */
export function noProgressOf(options: string[]): string | undefined {
  for (let i = 0; i < options.length; i++) {
    const o = options[i]!
    if (o === "--no-progress") return options[i + 1]?.trim() || undefined
    if (o.startsWith("--no-progress=")) return o.slice("--no-progress=".length).trim() || undefined
  }
  return undefined
}

/** Whether a run's command reports progress: it names NAIMA_RUN_PROGRESS, or runs a Naima command in `reporting`. */
export function commandReports(command: string[], reporting: ReadonlySet<string>): boolean {
  if (command.some((w) => w.includes("NAIMA_RUN_PROGRESS"))) return true
  // One word is a command line for the shell: its own simple commands are read.
  const commands = command.length === 1 ? simpleCommands(command[0]!) : [command]
  return commands.some((words) => {
    const cmd = naimaCommand(words)
    return cmd !== null && reporting.has(cmd.name)
  })
}
