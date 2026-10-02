// The host's own tools, and the program directory. The program is ignored by
// git, but some tools walk the file system without reading .gitignore: even
// a copy of naima/, which holds only runtime files, reaches `deno check`, `tsc` and `prettier` through
// its .ts files. None of them has a marker a directory could carry, so the
// exclusion lives in the host's own configuration: `naima init` prints the
// line for each such file it finds, and writes it only when asked
// (`init --write-excludes`), since everything else it does stays inside
// naima-tracker/ (docs/guide/install.md#the-hosts-own-tools).

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Every host file `init --write-excludes` may write, from the project root: the launcher grants exactly these. */
export const EXCLUDE_FILES = ["deno.json", "deno.jsonc", "tsconfig.json", ".prettierignore"] as const

/** Prettier's configuration files: one of them present means the project runs prettier. */
const PRETTIER = [
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.json5",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.mjs",
  ".prettierrc.toml",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
  "prettier.config.ts",
]

export interface Exclusion {
  /** The host file, from the project root. */
  file: string
  /** What to add, as the file writes it. */
  line: string
  /** Write it; false when it cannot be written safely (a file with comments), and must be added by hand. */
  write(): boolean
  /** Already there. */
  present: boolean
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** A JSON file's `exclude` list, gaining `entry`: null when the file is not plain JSON (JSONC comments), so it is left to a person. */
function jsonExclude(path: string, entry: string, fallback: string[]): Omit<Exclusion, "file"> {
  const text = readFileSync(path, "utf8")
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    raw = null
  }
  const list = isObject(raw) && Array.isArray(raw["exclude"]) ? (raw["exclude"] as unknown[]) : null
  const present = !!list?.some((e) => typeof e === "string" && e.replace(/\/+$/, "") === entry.replace(/\/+$/, ""))
  return {
    line: `"exclude": [${[...(list ? [] : fallback), entry].map((e) => JSON.stringify(e)).join(", ")}]`,
    present,
    write() {
      if (!isObject(raw)) return false
      if (present) return true
      raw["exclude"] = [...(list ?? fallback), entry]
      // Not writeFileAtomic: the launcher grants write access to this one host file, not to a temporary file beside it.
      writeFileSync(path, JSON.stringify(raw, null, 2) + "\n")
      return true
    },
  }
}

/**
 * The exclusions for the host tools this project configures, with the program
 * directory `program` (from the root, forward slashes). A tool the project
 * does not configure gets none: Naima creates no configuration of its own.
 */
export function exclusions(root: string, program: string): Exclusion[] {
  const dir = program.replace(/\/+$/, "") + "/"
  const out: Exclusion[] = []
  for (const file of ["deno.json", "deno.jsonc"]) {
    if (existsSync(join(root, file))) out.push({ file, ...jsonExclude(join(root, file), dir, []) })
  }
  // tsc drops its default exclusions once `exclude` is given, so a new list keeps node_modules.
  if (existsSync(join(root, "tsconfig.json"))) {
    out.push({ file: "tsconfig.json", ...jsonExclude(join(root, "tsconfig.json"), dir.slice(0, -1), ["node_modules"]) })
  }
  const ignore = join(root, ".prettierignore")
  if (existsSync(ignore) || PRETTIER.some((f) => existsSync(join(root, f)))) {
    const text = existsSync(ignore) ? readFileSync(ignore, "utf8") : ""
    const present = text.split("\n").some((l) => l.trim().replace(/^\/+|\/+$/g, "") === dir.replace(/\/+$/, ""))
    out.push({
      file: ".prettierignore",
      line: dir,
      present,
      write() {
        if (!present) writeFileSync(ignore, text + (text && !text.endsWith("\n") ? "\n" : "") + dir + "\n")
        return true
      },
    })
  }
  return out
}
