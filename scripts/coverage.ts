// Coverage of the whole test run, subprocesses included.
//
//   deno task coverage            the summary table, one row per source file
//   deno task coverage --lcov     lcov on stdout, for a viewer
//
// The distribution tests run Naima the way a project does: a copy of this
// source cloned into a temporary project, run through its launcher as its own
// process. Deno records those runs under the copy's paths, which are deleted
// when the test ends, so without help their coverage is lost and a module
// only they exercise (program.ts, the launcher) reads as barely run. Each
// such record is mapped back to the file of this repository it is a copy of,
// when that file is byte-identical, before the report is made.

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { RUNTIME_DIR } from "../naima/src/core/layout.ts"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** The file of this repository a copied source is, or null: `…/naima-tracker/naima/src/x.ts` or `…/<tmp>/naima/src/x.ts` → `naima/src/x.ts`. */
export function original(url: string, root = ROOT): string | null {
  if (!url.startsWith("file://")) return null
  const path = fileURLToPath(url)
  if (path.startsWith(root + "/") || path.startsWith(root + "\\")) return null // already this repository's
  const m = path.replace(/\\/g, "/").match(/\/naima\/((?:src\/.+|naima\.ts))$/)
  if (!m?.[1]) return null
  const mine = join(root, RUNTIME_DIR, m[1])
  return existsSync(mine) && readFileSync(mine, "utf8") === readFileSync(path, "utf8") ? mine : null
}

/**
 * Rewrite every raw coverage record in `dir` whose script is a copy of a file
 * here, and drop the rest that lie outside this repository (test fixtures,
 * copies that were edited on purpose): the report is of this repository's
 * files only.
 */
export function remap(dir: string, root = ROOT): { mapped: number; dropped: number } {
  let mapped = 0
  let dropped = 0
  const ours = (url: string): boolean => {
    try {
      const path = fileURLToPath(url)
      return path.startsWith(root + "/") || path.startsWith(root + "\\")
    } catch {
      return false
    }
  }
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const path = join(dir, name)
    const record = JSON.parse(readFileSync(path, "utf8")) as { url?: string }
    if (typeof record.url !== "string" || ours(record.url)) continue
    let mine: string | null = null
    try {
      mine = original(record.url, root)
    } catch {
      mine = null // the copy is gone: nothing to compare it with, so it is not claimed
    }
    if (mine) {
      record.url = pathToFileURL(mine).href
      writeFileSync(path, JSON.stringify(record))
      mapped++
    } else if (record.url.startsWith("file://")) {
      rmSync(path)
      dropped++
    }
  }
  return { mapped, dropped }
}

if (import.meta.main) {
  const work = mkdtempSync(join(tmpdir(), "naima-coverage-"))
  const dir = join(work, "raw")
  const temps = join(work, "tmp")
  mkdirSync(temps)
  const lcov = Deno.args.includes("--lcov")
  try {
    // The copies must still exist when they are compared: the tests keep their temporary projects (NAIMA_KEEP_TEMP), under a TMPDIR removed at the end.
    const env = { ...process.env, NAIMA_KEEP_TEMP: "1", TMPDIR: temps, TMP: temps, TEMP: temps }
    // The test run's own output is kept back: it names every copy's path, which is what this script resolves.
    const test = spawnSync("deno", ["test", "-A", `--coverage=${dir}`, "test/"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
      maxBuffer: 1 << 28,
    })
    if (test.status !== 0) {
      process.stderr.write(test.stdout + test.stderr)
      throw new Error("the tests failed; no coverage report")
    }
    const { mapped, dropped } = remap(dir)
    console.error(`coverage: ${mapped} records of copied sources mapped back to this repository; ${dropped} of files outside it dropped`)
    const report = spawnSync("deno", ["coverage", ...(lcov ? ["--lcov"] : []), "--exclude=\\.test\\.ts$", "--exclude=/scripts/", "--exclude=/test/", dir], {
      cwd: ROOT,
      stdio: ["ignore", "inherit", "inherit"],
    })
    Deno.exitCode = report.status ?? 1
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
