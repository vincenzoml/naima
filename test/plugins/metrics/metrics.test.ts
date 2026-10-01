import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { type Context, createItem, DATA_FILE, type Plugin, runChecks, typeOrThrow } from "../../../naima/src/core/api.ts"
import { declaredRuns } from "../../../naima/src/core/base.ts"
import { mayRun } from "../../../naima/src/launcher.ts"
import metrics, {
  history,
  judge,
  loosens,
  measure,
  type MetricConfig,
  type MetricDef,
  readMetrics,
  sparkline,
} from "../../../naima/src/plugins/metrics/index.ts"
import { firstPartyPlugins } from "../../../naima/src/builtins.ts"
import { removeTemp, tempProject } from "../../core/testing.ts"

const metric = (ctx: Context, name: string): MetricDef => ctx.registry.find<MetricDef>("metrics", name)!.value
const run = (m: Partial<MetricConfig>): MetricConfig => ({ run: ["git"], ...m })

test("each kind of expectation holds, fails, and a ratchet fails on a gain the bound has not followed", () => {
  // exit 0: kind exit with no bound
  assert.equal(judge(run({}), 0).holds, true)
  assert.equal(judge(run({}), 1).holds, false)
  // equal to a baseline
  assert.equal(judge(run({ kind: "number", equals: 3 }), 3).holds, true)
  assert.match(judge(run({ kind: "number", equals: 3 }), 4).why, /differs from the baseline 3/)
  // at most a budget
  assert.equal(judge(run({ kind: "duration", atMost: 10 }), 10).holds, true)
  assert.match(judge(run({ kind: "duration", atMost: 10 }), 11).why, /past the budget 10/)
  assert.equal(judge(run({ kind: "duration", atMost: 10, tolerance: 2 }), 11).holds, true)
  // at least a floor
  assert.equal(judge(run({ kind: "number", atLeast: 197 }), 200).holds, true)
  assert.equal(judge(run({ kind: "number", atLeast: 197 }), 196).holds, false)
  // a ratchet: a budget only goes down, a floor only up
  const budget = judge(run({ kind: "count", atMost: 5, ratchet: true }), 3)
  assert.deepEqual([budget.holds, budget.moveTo], [false, 3])
  assert.match(budget.why, /lower it/)
  const floor = judge(run({ kind: "number", atLeast: 197, ratchet: true }), 201)
  assert.deepEqual([floor.holds, floor.moveTo], [false, 201])
  assert.equal(judge(run({ kind: "number", atLeast: 197, ratchet: true, tolerance: 5 }), 201).holds, true)
  // no bound: recorded only
  assert.equal(judge(run({ kind: "number" }), 42).holds, true)
  // loosening: a budget up, a floor down, a baseline moved
  assert.deepEqual([loosens(run({ atMost: 5 }), 6), loosens(run({ atMost: 5 }), 4)], [true, false])
  assert.deepEqual([loosens(run({ atLeast: 5 }), 4), loosens(run({ atLeast: 5 }), 6)], [true, false])
  assert.equal(loosens(run({ equals: 5 }), 6), true)
})

test("a malformed metric is refused when the project loads, naming it", () => {
  assert.throws(() => readMetrics({ metrics: { t: { run: "deno task test" } } }), /metric "t": run is the command as a list/)
  assert.throws(() => readMetrics({ metrics: { t: { run: ["git"], atMost: 1, atLeast: 0 } } }), /one bound at most/)
  assert.throws(() => readMetrics({ metrics: { t: { run: ["git"], kind: "number", ratchet: true } } }), /ratchet needs a budget/)
  assert.throws(() => readMetrics({ metrics: { t: { run: ["git"], pattern: "(" } } }), /pattern is not a regular expression/)
  assert.throws(() => readMetrics({ metrics: { T: { run: ["git"] } } }), /a name is lowercase/)
  assert.deepEqual(Object.keys(readMetrics({ metrics: { t: { run: ["git", "--version"] } } })), ["t"])
})

test("every first-party kind reads its number from a real run", () => {
  const config = {
    metrics: {
      ok: { run: ["git", "--version"] },
      bad: { run: ["git", "rev-parse", "--verify", "no-such-ref"] },
      version: { run: ["git", "--version"], kind: "number", pattern: "version (\\d+)" },
      commits: { run: ["git", "log", "--oneline"], kind: "count" },
      time: { run: ["git", "--version"], kind: "duration", atMost: 60 },
      missing: { run: ["no-such-program-naima"], kind: "number" },
    },
  }
  const p = tempProject([metrics(config)], { git: true })
  try {
    const { ctx } = p
    assert.deepEqual(measure(ctx, metric(ctx, "ok")), { value: 0, exit: 0 })
    assert.equal(measure(ctx, metric(ctx, "bad")).value, 128)
    assert.ok((measure(ctx, metric(ctx, "version")).value ?? 0) >= 2)
    assert.equal(measure(ctx, metric(ctx, "commits")).value, 1)
    const time = measure(ctx, metric(ctx, "time")).value
    assert.ok(time !== null && time >= 0 && time < 60)
    assert.match(measure(ctx, metric(ctx, "missing")).error ?? "", /could not be started/)
  } finally {
    p.cleanup()
  }
})

test("run --record writes evidence per commit, every number printed with its baseline, and trend draws the line", async () => {
  const config = { metrics: { commits: { run: ["git", "log", "--oneline"], kind: "count", atLeast: 1, ratchet: true } } }
  const p = tempProject(firstPartyPlugins({ metrics: config }), { git: true })
  try {
    const { ctx } = p
    assert.equal(await p.run("metrics", "run", "--record"), 0)
    assert.match(p.output.join("\n"), /✓ commits: 1 \(was none; floor 1\) — within the floor/)
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "second")
    p.output.length = 0
    // a gain the floor has not followed fails, and says the command that moves it
    assert.equal(await p.run("metrics", "run", "--record"), 1)
    const out = p.output.join("\n")
    assert.match(out, /✗ commits: 2 \(was 1, \+1; floor 1\) — a gain the floor 1 has not followed: raise it — naima metrics bound commits 2/)
    assert.match(out, /1 of 1 metrics fail/)
    assert.deepEqual(history(ctx, "commits").map((h) => h.value), [1, 2])
    p.output.length = 0
    assert.equal(await p.run("metrics", "trend", "commits"), 0)
    assert.match(p.output.join("\n"), /commits \(floor 1\): ▁█ {2}1 → 2/)
    assert.match(p.output.join("\n"), /, \+1/)
    // the gate reads the last record of HEAD
    const gate = ctx.registry.find<{ evaluate(c: Context): { holds: boolean } }>("gates", "metrics")!.value
    assert.equal(gate.evaluate(ctx).holds, false)
  } finally {
    p.cleanup()
  }
})

// A stand-in for the plugin that declares item types: plugins never import each other.
const open = { category: "open" as const, says: "" }
const fixture = (): Plugin => ({
  name: "fixture",
  says: "",
  types: [{ id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open }, initialStatus: "open" }],
})

test("a bound is loosened only with an item that says why; tightening needs none", async () => {
  const config = { metrics: { warnings: { run: ["git", "--version"], kind: "count", atMost: 5 } } }
  const p = tempProject([fixture(), metrics(config)])
  try {
    const { ctx } = p
    const file = join(ctx.trackerRoot, DATA_FILE)
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), plugins: { metrics: { options: config } } }))
    await assert.rejects(p.run("metrics", "bound", "warnings", "7"), /loosens it: name the item that says why/)
    const why = createItem(ctx, typeOrThrow(ctx, "bugs"), "A new linter rule", {})
    assert.equal(await p.run("metrics", "bound", "warnings", "7", "--because", why.slug), 0)
    const written = () => JSON.parse(readFileSync(file, "utf8")).plugins.metrics.options.metrics.warnings
    assert.deepEqual([written().atMost, written().because], [7, why.meta.id])
    assert.equal(await p.run("metrics", "bound", "warnings", "4"), 0, "tightening")
    assert.deepEqual([written().atMost, written().because], [4, undefined])
    assert.equal(sparkline([1, 1]), "▄▄")
  } finally {
    p.cleanup()
  }
})

test("a metric's because must name an item, and its kind must exist", async () => {
  const p = tempProject([metrics({ metrics: { w: { run: ["git"], kind: "nope", because: "00000000-0000-0000-0000-000000000000" } } })])
  try {
    const r = await runChecks(p.ctx)
    const messages = r.problems.map((f) => f.message).join("\n")
    assert.match(messages, /metric w: because names 00000000/)
    assert.match(messages, /metric w: no metric kind "nope"/)
  } finally {
    p.cleanup()
  }
})

test("the launcher lets the program start the metrics' programs, and only when metrics are declared", () => {
  const p = tempProject([metrics({ metrics: { t: { run: ["deno", "task", "test"] }, l: { run: ["git", "status"] } } })])
  try {
    assert.deepEqual(declaredRuns(p.ctx), ["deno", "git"])
  } finally {
    p.cleanup()
  }
  const dir = mkdtempSync(join(tmpdir(), "naima-runs-"))
  try {
    writeFileSync(join(dir, DATA_FILE), JSON.stringify({ plugins: {} }))
    assert.equal(mayRun(dir), false)
    writeFileSync(join(dir, DATA_FILE), JSON.stringify({ plugins: { metrics: { options: { metrics: { t: { run: ["deno"] } } } } } }))
    assert.equal(mayRun(dir), true)
  } finally {
    removeTemp(dir)
  }
})
