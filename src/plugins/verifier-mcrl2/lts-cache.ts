// The LTS cache of the LTS route (specs/verifier-mcrl2-lts-route-cross-check,
// §4): one LTS per model version, shared by every property on it, under the
// run work folder. An entry is a folder named by its key, holding model.lps,
// model.lts and lts.json; it is generated elsewhere and renamed into place
// whole, so a reader never sees a partial one.

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs"
import { join } from "node:path"
import { writeJson } from "../../core/api.ts"

/** What an entry records about the LTS it holds. */
export interface LtsRecord {
  key: string
  /** The model, from the project root. */
  model: string
  inputs: { path: string; sha256: string }[]
  toolVersion: string
  recipe: Record<string, string[]>
  ltsSha256: string
  states: number
  transitions: number
  labels: string[]
  generationSeconds: number
  at: string
}

export const ENTRY_LTS = "model.lts"
export const ENTRY_LPS = "model.lps"
export const ENTRY_RECORD = "lts.json"

/** JSON with every object's keys sorted: the same value always hashes the same. */
export const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
    ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`
    : JSON.stringify(v) ?? "null"

export const sha256File = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex")

/** The key of an LTS: the model's inputs with their contents' digests, the toolset's version, and the recipe that makes it. */
export function cacheKey(inputs: LtsRecord["inputs"], toolVersion: string, recipe: LtsRecord["recipe"]): string {
  return createHash("sha256").update(canonical({ inputs: inputs.map((i) => [i.path, i.sha256]), toolVersion, recipe })).digest("hex")
}

/** The cache folder inside a run work folder, made when absent. */
export function cacheRoot(work: string): string {
  const root = join(work, "lts")
  mkdirSync(root, { recursive: true })
  return root
}

function readRecord(dir: string): LtsRecord | null {
  try {
    const r = JSON.parse(readFileSync(join(dir, ENTRY_RECORD), "utf8")) as LtsRecord
    return r && typeof r === "object" && typeof r.key === "string" && typeof r.model === "string" ? r : null
  } catch {
    return null
  }
}

/** The entry of `key`, when it is there whole: its record names the key and its LTS has the sha256 recorded. */
export function readEntry(root: string, key: string): { dir: string; record: LtsRecord } | null {
  const dir = join(root, key)
  const record = readRecord(dir)
  if (!record || record.key !== key || !existsSync(join(dir, ENTRY_LTS))) return null
  if (sha256File(join(dir, ENTRY_LTS)) !== record.ltsSha256) return null
  return { dir, record }
}

/** A fresh folder to generate an entry in, beside the entries, never mistaken for one. */
export const freshFolder = (root: string): string => mkdtempSync(join(root, "tmp-"))

/** An entry folder that is not whole is removed, so it can be generated again. */
export const discard = (dir: string): void => rmSync(dir, { recursive: true, force: true })

/**
 * Publish a generated folder as the entry of `key`: renamed into place whole. When another run published the same key
 * first, its entry is used and this one discarded; an entry that is there but not whole is replaced.
 */
export function publish(root: string, folder: string, record: LtsRecord): { dir: string; record: LtsRecord } {
  writeJson(join(folder, ENTRY_RECORD), record)
  const dir = join(root, record.key)
  try {
    renameSync(folder, dir)
  } catch (e) {
    const there = readEntry(root, record.key)
    if (there) {
      discard(folder)
      return there
    }
    if (!existsSync(dir)) throw e
    discard(dir)
    renameSync(folder, dir)
  }
  return { dir, record }
}

/** Remove the entries of the same model under another key: a model at a new version supersedes the LTS of the old one. */
export function prune(root: string, keep: string, model: string): string[] {
  const removed: string[] = []
  for (const name of readdirSync(root)) {
    if (name === keep || name.startsWith("tmp-")) continue
    const record = readRecord(join(root, name))
    if (record?.model === model) {
      discard(join(root, name))
      removed.push(name)
    }
  }
  return removed
}
