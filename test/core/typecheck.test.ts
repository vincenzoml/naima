// The compiler holds field access: a field is read through a typed accessor,
// and a misspelt field name read straight off meta does not compile.

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { removeTemp } from "./testing.ts"

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

function check(source: string): { ok: boolean; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "naima-typecheck-"))
  try {
    const file = join(dir, "probe.ts")
    writeFileSync(file, source.replaceAll("CORE", pathToFileURL(join(ROOT, "naima", "src", "core", "api.ts")).href))
    const r = spawnSync("deno", ["check", "--quiet", "--config", join(ROOT, "deno.json"), file], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } })
    return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` }
  } finally {
    removeTemp(dir)
  }
}

test("a misspelt field read off meta does not compile; the typed accessor does, with the field's type", () => {
  const typo = check(`import type { Item } from "CORE"\nexport const f = (item: Item) => item.meta.fixdOn\n`)
  assert.equal(typo.ok, false)
  assert.match(typo.out, /TS4111/)
  const typed = check(
    `import { type Item, fieldValue } from "CORE"\nconst FIXED_ON = { name: "fixedOn", kind: "date" } as const\nexport const f = (item: Item): string | undefined => fieldValue(item, FIXED_ON)\nexport const g = (item: Item): string[] | undefined => fieldValue(item, { name: "tags", kind: "strings" } as const)\n`,
  )
  assert.equal(typed.ok, true, typed.out)
})
