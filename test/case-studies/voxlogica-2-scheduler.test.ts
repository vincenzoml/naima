import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { mcrl2Verifier } from "../../naima/src/plugins/verifier-mcrl2/index.ts"

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..", "..")
const DIR = "develop/case-studies/voxlogica-2-scheduler"
const at = (f: string): string => join(ROOT, DIR, f)
const PROPERTIES = ["deadlock-freedom.mcf", "exactly-once.mcf", "dependency-order.mcf", "determinism.mcf"]
const VARIANTS: Record<string, string> = { "scheduler-no-guard.mcrl2": "dupGuard", "scheduler-no-floor.mcrl2": "progressFloor" }

test("the VoxLogicA 2 scheduler case study: the model, its four property formulas and its description are in place", () => {
  for (const f of ["README.md", "scheduler.mcrl2", ...PROPERTIES, ...Object.keys(VARIANTS)]) assert.ok(existsSync(at(f)), `${DIR}/${f} is missing`)
  const model = readFileSync(at("scheduler.mcrl2"), "utf8")
  assert.match(model, /^\s*dupGuard = true;$/m)
  assert.match(model, /^\s*progressFloor = true;$/m)
})

test("each negative variant is the model with exactly one safeguard switched off, and nothing else changed", () => {
  const model = readFileSync(at("scheduler.mcrl2"), "utf8").split("\n")
  for (const [file, flag] of Object.entries(VARIANTS)) {
    const variant = readFileSync(at(file), "utf8").split("\n")
    assert.equal(variant.length, model.length, `${file} has a different number of lines than scheduler.mcrl2`)
    const differ = model.map((line, i) => [line, variant[i]] as const).filter(([a, b]) => a !== b)
    assert.deepEqual(differ, [[`     ${flag} = true;`, `     ${flag} = false;`]], `${file} must differ from scheduler.mcrl2 only in ${flag}`)
  }
})

const onPath = spawnSync("mcrl22lps", ["--version"], { encoding: "utf8" }).status === 0

test("mCRL2 live: the four properties hold on the model, and each switched-off safeguard is caught", {
  skip: !onPath && "mCRL2 is not on PATH (mcrl22lps --version failed)",
  // Six real model-checker runs: well past a runner's default per-test limit.
  timeout: 600_000,
}, async () => {
  const v = mcrl2Verifier()
  const ctx = { root: ROOT } as never
  const verdict = async (model: string, property: string) => (await v.verify({ model: at(model), property: `${DIR}/${property}`, options: {} }, ctx)).verdict
  for (const p of PROPERTIES) assert.equal(await verdict("scheduler.mcrl2", p), "holds", p)
  assert.equal(await verdict("scheduler-no-guard.mcrl2", "exactly-once.mcf"), "violated")
  assert.equal(await verdict("scheduler-no-floor.mcrl2", "deadlock-freedom.mcf"), "violated")
})
