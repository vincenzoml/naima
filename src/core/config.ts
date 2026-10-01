// The project file, `naima-data/naima.json`.
//
// Automatic first: every first-party plugin is loaded, with defaults it infers
// from the repository, unless the project says otherwise. The file holds only
// what the tool cannot infer — the data formats, the lock (which Naima runs:
// its source, commit and how it is carried), where the program is when it has
// moved — and the `plugins` table: a plugin's options, a plugin switched off
// or replaced, a third-party plugin added, a check weighed differently. The
// format is specified in docs/reference/format.md.

import { readFileSync } from "node:fs"
import { isAbsolute, join, relative, resolve, sep } from "node:path"
import { message } from "./errors.ts"
import { writeFileAtomic } from "./files.ts"
import { DATA_FILE, DEFAULT_PROGRAM } from "./layout.ts"
import { FORMAT, formatRefusal, formatsOf } from "./format.ts"
import type { Carry, Config, Extension, PluginConfig, PluginOptions, PluginSource, Severity } from "./types.ts"

export const CARRY_MODES: readonly Carry[] = ["clone", "vendored", "submodule"]

const KEYS = new Set(["format", "formats", "source", "commit", "carry", "verify", "program", "plugins", "rename", "extends"])
const COMMIT = /^[0-9a-f]{40}$/

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

export type Lock = Pick<Config, "source" | "commit" | "carry" | "verify" | "program">

/** A source on this disk rather than behind a URL. */
export const isLocalSource = (source: string): boolean => source.startsWith("file:") || !/^([a-z][a-z0-9+.-]*:\/\/|[^/\\\s]+@[^:/\\\s]+:)/i.test(source)

/**
 * Why `source` cannot be a lock's source, or null. It is handed to git as an
 * argument, so it never starts with "-" (git would read it as an option); a
 * path on this disk is absolute, or it would resolve against whatever
 * directory git happens to run in.
 */
export function sourceRefusal(source: string): string | null {
  if (source.startsWith("-")) return 'must not start with "-": git would read it as an option'
  if (isLocalSource(source) && !source.startsWith("file:") && !isAbsolute(source)) {
    return "a path on this disk must be absolute: a relative one resolves against wherever git runs"
  }
  return null
}

/**
 * The lock: which Naima runs the project, and where it is. The same keys in
 * every format, so that a Naima can be aligned, and can update, whatever the
 * format of the data it is about to read.
 */
export function parseLock(raw: Record<string, unknown>): Lock {
  const { source, commit } = raw
  if (typeof source !== "string" || !source.trim()) {
    throw new Error(`${DATA_FILE}: source must be the git URL (or absolute path) of the Naima this project runs`)
  }
  const refusal = sourceRefusal(source)
  if (refusal) throw new Error(`${DATA_FILE}: source ${refusal}`)
  if (typeof commit !== "string" || !COMMIT.test(commit)) throw new Error(`${DATA_FILE}: commit must be the full hash of the Naima commit this project runs`)
  const carry = raw["carry"] ?? "clone"
  if (!CARRY_MODES.includes(carry as Carry)) throw new Error(`${DATA_FILE}: carry must be one of: ${CARRY_MODES.join(", ")}`)
  const program = raw["program"] ?? DEFAULT_PROGRAM
  if (typeof program !== "string" || !program.trim()) throw new Error(`${DATA_FILE}: program must be a path, relative to the data directory`)
  const verify = raw["verify"]
  if (verify !== undefined && verify !== "signed") throw new Error(`${DATA_FILE}: verify is "signed", or absent`)
  return { source, commit, carry: carry as Carry, ...(verify ? { verify } : {}), program }
}

/**
 * The contents of a naima.json in the format this Naima reads. Throws with the
 * reason when it is not one. `lenient` reads a naima.json whose core shape is
 * current but which still owes a plugin's migration: its format and any key a
 * plugin's migration will move are not held — only to load the plugins whose
 * migrations it owes.
 */
export function parseConfig(raw: unknown, opts: { lenient?: boolean } = {}): Config {
  if (!isObject(raw)) throw new Error(`${DATA_FILE} must hold a JSON object`)
  const refusal = formatRefusal(raw["format"])
  if (refusal && !opts.lenient) throw new Error(`${DATA_FILE} ${refusal}`)
  for (const key of Object.keys(raw)) {
    if (!KEYS.has(key) && !opts.lenient) {
      throw new Error(`${DATA_FILE}: unknown key "${key}" — it holds only ${[...KEYS].join(", ")}; everything else is inferred`)
    }
  }
  const lock = parseLock(raw)
  const extensions = raw["extends"] ?? []
  if (!Array.isArray(extensions) || !extensions.every(isObject)) {
    throw new Error(
      `${DATA_FILE}: extends is a list of extensions: { "type", "statuses", "traits", "transitions" } or { "field", "values", "appliesTo", "traits" }`,
    )
  }
  return {
    format: FORMAT,
    formats: formatsOf(raw),
    ...lock,
    plugins: parsePlugins(raw["plugins"]),
    rename: parseRename(raw["rename"]),
    extends: extensions as Extension[],
  }
}

/** The `rename` table: kind → qualified id → new short name. Which ids exist is the registry's to say. */
function parseRename(value: unknown): Record<string, Record<string, string>> {
  if (value === undefined) return {}
  const shape = `${DATA_FILE}: rename maps a kind to { "<plugin>/<name>": "<new name>" }`
  if (!isObject(value)) throw new Error(shape)
  for (const table of Object.values(value)) {
    if (!isObject(table) || !Object.values(table).every((v) => typeof v === "string")) throw new Error(shape)
  }
  return value as Record<string, Record<string, string>>
}

const ENTRY_KEYS = new Set(["enabled", "options", "source", "replacedBy", "checks"])
const SEVERITIES = new Set<string>(["off", "note", "problem"])
/** A plugin's name: what its contributions' qualified ids start with. */
export const PLUGIN_NAME = /^[a-z][a-z0-9-]*$/

const SHA256 = /^[0-9a-f]{64}$/
const COMMIT_HASH = /^[0-9a-f]{40}$/

/**
 * Why `v` is not where a plugin's code is, or null: a path inside the
 * program; `{ "path", "sha256" }`, a file of the project pinned by its hash;
 * or `{ "git", "commit", "path" }`, a module of a repository pinned by commit.
 */
function sourceShape(v: unknown): string | null {
  const shapes = 'is a path inside the program, { "path", "sha256" } — a file of the project and its hash — or { "git", "commit", "path" }'
  if (typeof v === "string") return v.trim() ? null : shapes
  if (!isObject(v)) return shapes
  const keys = Object.keys(v).sort().join(",")
  if (keys === "path,sha256") {
    if (typeof v["path"] !== "string" || !v["path"].trim()) return "path must name a file of the project"
    return typeof v["sha256"] === "string" && SHA256.test(v["sha256"]) ? null : "sha256 must be the file's sha256, 64 hex digits"
  }
  if (keys === "commit,git,path") {
    if (typeof v["git"] !== "string" || !v["git"].trim()) return "git must be the URL, or absolute path, of the plugin's repository"
    const refusal = sourceRefusal(v["git"])
    if (refusal) return `git ${refusal}`
    if (typeof v["commit"] !== "string" || !COMMIT_HASH.test(v["commit"])) return "commit must be the full hash of the commit it runs"
    return typeof v["path"] === "string" && v["path"].trim() ? null : "path must name the module inside the repository"
  }
  return shapes
}

/** The `plugins` table: plugin name → its configuration. Which names are first-party is the loader's to say. */
function parsePlugins(value: unknown): Record<string, PluginConfig> {
  if (value === undefined) return {}
  if (!isObject(value)) {
    throw new Error(`${DATA_FILE}: plugins maps a plugin's name to its configuration: { "options", "enabled", "source", "replacedBy", "checks" }`)
  }
  const out: Record<string, PluginConfig> = {}
  for (const [name, entry] of Object.entries(value)) {
    const where = `${DATA_FILE}: plugins.${name}`
    if (!PLUGIN_NAME.test(name)) throw new Error(`${where}: a plugin's name is lowercase letters, digits and dashes, starting with a letter`)
    if (!isObject(entry)) throw new Error(`${where} must be an object: { "options", "enabled", "source", "replacedBy", "checks" }`)
    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.has(key)) throw new Error(`${where}: unknown key "${key}" — an entry holds ${[...ENTRY_KEYS].join(", ")}`)
    }
    const { enabled = true, options = {}, source, replacedBy, checks = {} } = entry
    if (typeof enabled !== "boolean") throw new Error(`${where}.enabled must be true or false`)
    if (!isObject(options)) throw new Error(`${where}.options must be an object`)
    for (const [key, v] of [["source", source], ["replacedBy", replacedBy]] as const) {
      const why = v === undefined ? null : sourceShape(v)
      if (why) throw new Error(`${where}.${key} ${why}`)
    }
    if (source !== undefined && replacedBy !== undefined) {
      throw new Error(`${where}: source is a third-party plugin's, replacedBy a first-party one's — not both`)
    }
    if (!isObject(checks)) throw new Error(`${where}.checks maps a check's name to off, note or problem`)
    for (const [check, level] of Object.entries(checks)) {
      if (typeof level !== "string" || !SEVERITIES.has(level)) throw new Error(`${where}.checks.${check} must be off, note or problem`)
    }
    out[name] = {
      enabled,
      options: options as PluginOptions,
      ...(source !== undefined ? { source: source as PluginSource } : {}),
      ...(replacedBy !== undefined ? { replacedBy: replacedBy as PluginSource } : {}),
      checks: checks as Record<string, Severity>,
    }
  }
  return out
}

/** The raw JSON of `<data>/naima.json`. */
export function readRaw(data: string): Record<string, unknown> {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(join(data, DATA_FILE), "utf8"))
  } catch (e) {
    throw new Error(`${DATA_FILE}: ${message(e)}`)
  }
  if (!isObject(raw)) throw new Error(`${DATA_FILE} must hold a JSON object`)
  return raw
}

export const readConfig = (data: string): Config => parseConfig(readRaw(data))

/** Write `<data>/naima.json`, keys in the order given. */
export function writeRaw(data: string, raw: Record<string, unknown>): void {
  writeFileAtomic(join(data, DATA_FILE), JSON.stringify(raw, null, 2) + "\n")
}

/**
 * The program directory `<data>/naima.json` names, or the default one when the
 * file cannot be read — the program then reports what is wrong with it. For
 * the launcher, which must know where the program is before anything runs.
 */
export function programOf(data: string): string {
  try {
    const raw = readRaw(data)
    return resolve(data, typeof raw["program"] === "string" ? raw["program"] : DEFAULT_PROGRAM)
  } catch {
    return resolve(data, DEFAULT_PROGRAM)
  }
}

/** The absolute program directory of a project whose data is `data`. */
export const programDir = (data: string, config: Pick<Config, "program">): string => resolve(data, config.program)

/** A path from `from` to `to`, with forward slashes: for messages, and for git. */
export const posixRelative = (from: string, to: string): string => relative(from, to).split(sep).join("/")
