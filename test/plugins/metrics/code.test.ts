import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { type Context, DATA_FILE } from "../../../naima/src/core/api.ts"
import { firstPartyPlugins } from "../../../naima/src/builtins.ts"
import { readMetrics, readRecords } from "../../../naima/src/plugins/metrics/index.ts"
import {
  builtinLanguages,
  commitSource,
  dependenciesIn,
  duplication,
  jsFunctions,
  matches,
  selectFiles,
  statistic,
  stripComments,
  workingTreeSource,
} from "../../../naima/src/plugins/metrics/code.ts"
import { htmlReport, plotSvg, ticks } from "../../../naima/src/plugins/metrics/plot.ts"
import { gitIn, removeTemp, tempProject } from "../../core/testing.ts"

const TS = builtinLanguages.find((l) => l.id === "typescript")!
const fns = (src: string) => jsFunctions(stripComments(src, TS))

test("the TypeScript estimator finds functions, arrows and methods, and counts each one's decisions", () => {
  const src = [
    "// if (a) { comment } && ||", //  1
    "export function plain(a: number): string {", //  2
    '  const s = "if (x) && y"', //  3
    "  if (a > 0 && a < 9) return `${a ? 1 : 2}`", //  4
    "  for (const x of [1]) while (x) break", //  5
    "  return s ?? /if|for/.source", //  6
    "}", //  7
    "const arrow = (x: number): number => x > 1 ? x : 0", //  8
    "const block = async (y?: string) => {", //  9
    "  try { y?.trim() } catch { return }", // 10
    "  const inner = () => { if (y) {} }", // 11
    "}", // 12
    "class K extends Object {", // 13
    "  handler: (x: number) => void", // 14
    "  private method(a: { b: number }): { c: number } {", // 15
    "    switch (a.b) { case 1: return { c: 1 }; case 2: return { c: 2 } }", // 16
    "    return { c: 0 }", // 17
    "  }", // 18
    "}", // 19
    "interface I { f(x: number): void; g: () => string }", // 20
    "type T = (x: number) => boolean", // 21
    "const o = { run(args: string[]) { return args.length || 0 }, n: 1 }", // 22
  ].join("\n")
  const found = fns(src).map((f) => [f.name, f.line, f.lines, f.complexity])
  assert.deepEqual(found, [
    ["plain", 2, 6, 7], // if, &&, the ternary in the template, for, while, ?? — the strings, comment and regex count nothing
    ["arrow", 8, 1, 2], // the ternary; its return type is no parameter
    ["block", 9, 4, 2], // catch; an optional parameter is no ternary
    ["inner", 11, 1, 2], // its own if, not the enclosing block's
    ["method", 15, 4, 3], // two cases; its parameter's and return's object types are no bodies
    ["run", 22, 1, 2], // ||
  ]) // the property's function type (14), the interface (20) and the type alias (21) are no functions
})

test("comments and blank lines are not code; strings that look like comments are", () => {
  const stripped = stripComments('a // x\n/* b\nc */\n\nd = "//not a comment"\ne = /\\/\\//g // re\n', TS)
  assert.deepEqual(stripped.split("\n").map((l) => l.trim()), ["a", "", "", "", 'd = "//not a comment"', "e = /\\/\\//g", ""])
  const py = builtinLanguages.find((l) => l.id === "python")!
  assert.equal(stripComments("x = '#'  # note\n", py).trim(), "x = '#'")
})

test("duplication, statistics, manifests and path selection", () => {
  const block = ["alpha = one(1)", "beta = two(2)", "gamma = three(3)", "delta = four(4)", "epsilon = five(5)", "zeta = six(6)"].join("\n")
  assert.equal(duplication([{ stripped: block }, { stripped: "other = thing()\n" + block }]).percent, 92.31)
  assert.equal(duplication([{ stripped: block }, { stripped: "unique = 1\nnothing = 2" }]).percent, 0)
  assert.deepEqual([statistic([1, 2, 3, 10]), statistic([1, 2, 3, 10], "max"), statistic([1, 2, 3, 10], "median"), statistic([], "mean")], [4, 10, 2.5, 0])
  assert.equal(dependenciesIn("package.json", JSON.stringify({ dependencies: { a: "1" }, devDependencies: { b: "1", c: "1" } })), 3)
  assert.equal(dependenciesIn("deno.json", '{ // c\n "imports": { "x": "jsr:@x/x" } }'), 1)
  assert.equal(dependenciesIn("requirements.txt", "# c\nrequests==2\n\nflask\n"), 2)
  assert.equal(dependenciesIn("Cargo.toml", '[package]\nname = "x"\n[dependencies]\nserde = "1"\n[dev-dependencies]\nrand = "0.8"\n'), 2)
  assert.equal(matches("src/core/a.ts", "src"), true)
  assert.equal(matches("srcx/a.ts", "src"), false)
  assert.equal(matches("test/a.test.ts", "**/*.test.ts"), true)
  assert.equal(matches("a.test.ts", "**/*.test.ts"), true)
  assert.deepEqual(ticks(0, 10), [0, 5, 10])
})

const CODE_METRICS = {
  metrics: {
    loc: { preset: "code.loc" },
    complexity: { preset: "code.complexity-max", atMost: 3 },
    todos: { preset: "code.todos", include: ["src"] },
    functions: { preset: "code.functions", language: "typescript" },
  },
}

test("a preset declares a metric with its measure, unit and direction; a malformed one is refused", () => {
  const m = readMetrics(CODE_METRICS)
  assert.deepEqual([m["complexity"]?.measure, m["complexity"]?.statistic, m["complexity"]?.better, m["complexity"]?.atMost], ["complexity", "max", "lower", 3])
  assert.deepEqual([m["loc"]?.unit, m["loc"]?.run], ["lines", undefined])
  assert.throws(() => readMetrics({ metrics: { x: { preset: "code.nope" } } }), /no preset "code.nope"/)
  assert.throws(() => readMetrics({ metrics: { x: { run: ["git"], measure: "loc" } } }), /run or measure, not both/)
  assert.throws(() => readMetrics({ metrics: { x: { kind: "number" } } }), /run is the command as a list/)
  assert.throws(() => readMetrics({ metrics: { x: { measure: "loc", statistic: "mode" } } }), /statistic is one of/)
  assert.throws(() => readMetrics({ metrics: { x: { measure: "loc", better: "up" } } }), /better is higher, lower or neither/)
})

const write = (root: string, path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true })
  writeFileSync(join(root, path), text)
}

test("code metrics are measured in process, recorded with the commit's date, and read back as history in text, JSON and CSV", async () => {
  const p = tempProject(firstPartyPlugins({ metrics: CODE_METRICS }), { git: true })
  try {
    const { root, ctx } = p
    write(root, "src/a.ts", "// TODO one\nexport function f(x: number) {\n  return x > 0 ? 1 : 2\n}\n")
    write(root, "README.md", "TODO not code\n")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "one")
    assert.equal(await p.run("metrics", "run", "--record"), 0)
    const out = p.output.join("\n")
    assert.match(out, /✓ loc: 3 lines \(was none; no bound\)/)
    assert.match(out, /✓ complexity: 2 \(was none; budget 3\) — within the budget/)
    assert.match(out, /✓ todos: 1 markers/)
    assert.match(out, /✓ functions: 1 functions/)
    const [record] = readRecords(ctx)
    assert.equal(record?.date, p.git("log", "-1", "--format=%cI"))
    write(root, "src/b.ts", "export const g = (a: boolean, b: boolean) => a && b || !a\n")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "two")
    p.output.length = 0
    assert.equal(await p.run("metrics", "run", "--record"), 0)
    p.output.length = 0
    assert.equal(await p.run("metrics", "history", "--csv"), 0)
    const csv = p.output.join("\n").split("\n")
    assert.equal(csv[0], "commit,date,loc,complexity,todos,functions")
    assert.match(csv[1] ?? "", /^[0-9a-f]{40},\d{4}-.*,3,2,1,1$/)
    assert.match(csv[2] ?? "", /,4,3,1,2$/)
    p.output.length = 0
    assert.equal(await p.run("metrics", "history", "loc", "--json"), 0)
    const json = JSON.parse(p.output.join("\n")) as { commit: string; values: Record<string, number> }[]
    assert.deepEqual(json.map((r) => r.values), [{ loc: 3 }, { loc: 4 }])
    p.output.length = 0
    assert.equal(await p.run("metrics", "history"), 0)
    assert.match(p.output.join("\n"), /commit\s+date\s+loc\s+complexity/)
  } finally {
    p.cleanup()
  }
})

test("backfill measures past commits without touching the working tree, and skips what is already recorded", async () => {
  const config = {
    metrics: {
      loc: { preset: "code.loc" },
      files: { run: ["git", "ls-files"], kind: "count", says: "files git tracks, counted in a checkout of the commit" },
    },
  }
  const p = tempProject(firstPartyPlugins({ metrics: config }), { git: true })
  try {
    const { root, ctx } = p
    for (let i = 1; i <= 4; i++) {
      write(root, `src/f${i}.ts`, `export const v${i} = ${i}\n`)
      p.git("add", "-A")
      p.git("commit", "-q", "-m", `c${i}`)
    }
    write(root, "src/f1.ts", "export const changed = 1\nexport const more = 2\n") // an uncommitted change backfill must not see or lose
    const before = p.git("status", "--porcelain", "--", ".", `:(exclude)${ctx.trackerDir}`)
    assert.equal(await p.run("metrics", "backfill", "--last", "4", "--every", "2"), 0)
    const out = p.output.join("\n")
    assert.match(out, /backfilled 2 commits/)
    assert.equal(p.git("status", "--porcelain", "--", ".", `:(exclude)${ctx.trackerDir}`), before, "the working tree is as it was")
    assert.equal(readFileSync(join(root, "src/f1.ts"), "utf8"), "export const changed = 1\nexport const more = 2\n")
    assert.equal(p.git("worktree", "list").split("\n").length, 1, "the temporary worktree is gone")
    const records = readRecords(ctx).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.commit.localeCompare(b.commit))
    const head = p.git("rev-parse", "HEAD")
    const second = p.git("rev-parse", "HEAD~2")
    assert.deepEqual(new Set(records.map((r) => r.commit)), new Set([head, second]))
    const atHead = records.find((r) => r.commit === head)!
    assert.deepEqual([atHead.values["loc"]?.value, atHead.values["files"]?.value, atHead.backfill], [4, 5, true], "HEAD as committed, not as edited")
    p.output.length = 0
    assert.equal(await p.run("metrics", "backfill", "--last", "4", "--every", "2"), 0)
    assert.match(p.output.join("\n"), /backfilled 0 commits; 2 already recorded/)
    // a past commit straight from git's objects
    const src = commitSource(root, second, [ctx.trackerDir])
    assert.deepEqual(selectFiles(src, builtinLanguages, {}).map((f) => f.path), ["src/f1.ts", "src/f2.ts"])
    assert.equal(workingTreeSource(root, [ctx.trackerDir]).read("src/f1.ts"), "export const changed = 1\nexport const more = 2\n")
  } finally {
    p.cleanup()
  }
})

test("code metrics read the files of a git submodule: the working tree, a past commit following the historical gitlink, and an absent commit counted as no files", async () => {
  // A standalone repository that will be added as a submodule: one commit, then a second that grows its file.
  const subRoot = mkdtempSync(join(tmpdir(), "naima-submodule-"))
  try {
    gitIn(subRoot, "init", "-q", "-b", "main")
    write(subRoot, "src/a.ts", "export const a = 1\n")
    gitIn(subRoot, "add", "-A")
    gitIn(subRoot, "commit", "-q", "-m", "sub1")

    const p = tempProject(firstPartyPlugins({ metrics: CODE_METRICS }), { git: true })
    try {
      const { root, ctx } = p
      // The same two lines, committed inline, as what a submodule holding them must measure equal to.
      write(root, "inline/a.ts", "export const a = 1\n")
      p.git("-c", "protocol.file.allow=always", "submodule", "add", "-q", subRoot, "sub")
      p.git("add", "-A")
      p.git("commit", "-q", "-m", "main1 — submodule at sub1")
      const main1 = p.git("rev-parse", "HEAD")

      // Advance the submodule's own history, then record the new commit as the main repository's gitlink.
      write(subRoot, "src/a.ts", "export const a = 1\nexport const b = 2\n")
      gitIn(subRoot, "add", "-A")
      gitIn(subRoot, "commit", "-q", "-m", "sub2")
      p.git("-C", "sub", "-c", "protocol.file.allow=always", "fetch", "-q")
      const sub2 = gitIn(subRoot, "rev-parse", "HEAD")
      p.git("-C", "sub", "checkout", "-q", sub2)
      write(root, "inline/a.ts", "export const a = 1\nexport const b = 2\n")
      p.git("add", "-A")
      p.git("commit", "-q", "-m", "main2 — submodule at sub2")
      const main2 = p.git("rev-parse", "HEAD")

      // The working tree: `ls-files --recurse-submodules` reaches into the checked-out submodule.
      const working = workingTreeSource(root, [ctx.trackerDir])
      assert.ok(working.files.includes("sub/src/a.ts"), "the submodule's file is listed")
      assert.equal(working.read("sub/src/a.ts"), "export const a = 1\nexport const b = 2\n")
      const workingFiles = selectFiles(working, builtinLanguages, {})
      const inlineLoc = workingFiles.find((f) => f.path === "inline/a.ts")!.codeLines
      const subLoc = workingFiles.find((f) => f.path === "sub/src/a.ts")!.codeLines
      assert.equal(subLoc, inlineLoc, "the submodule's file measures equal to the same file committed inline")

      // `include` names a file inside a submodule as it names any other.
      assert.deepEqual(selectFiles(working, builtinLanguages, { include: ["sub/**"] }).map((f) => f.path), ["sub/src/a.ts"])

      // A past commit follows the gitlink it recorded, not the submodule's current checkout.
      const atMain1 = commitSource(root, main1, [ctx.trackerDir])
      assert.equal(atMain1.read("sub/src/a.ts"), "export const a = 1\n", "the gitlink of the first commit, one line")
      const atMain2 = commitSource(root, main2, [ctx.trackerDir])
      assert.equal(atMain2.read("sub/src/a.ts"), "export const a = 1\nexport const b = 2\n", "the gitlink of the second commit, two lines")
      assert.equal(
        selectFiles(atMain2, builtinLanguages, {}).find((f) => f.path === "sub/src/a.ts")!.codeLines,
        selectFiles(atMain2, builtinLanguages, {}).find((f) => f.path === "inline/a.ts")!.codeLines,
      )

      // `metrics backfill` over the two commits: the submodule's lines count like any other file's.
      assert.equal(await p.run("metrics", "backfill", "--last", "2"), 0)
      const records = readRecords(ctx)
      const atHead = records.find((r) => r.commit === main2)!
      const atFirst = records.find((r) => r.commit === main1)!
      assert.equal(atFirst.values["loc"]?.value, 2, "1 inline line + 1 submodule line, at the first commit")
      assert.equal(atHead.values["loc"]?.value, 4, "2 inline lines + 2 submodule lines, at the second commit")

      // A gitlink whose commit the submodule's repository never received: no files, one line reported, no throw.
      const missingOid = "a".repeat(40)
      gitIn(root, "update-index", "--add", "--cacheinfo", `160000,${missingOid},sub`)
      const missingCommit = p.git("commit-tree", p.git("write-tree"), "-p", main2, "-m", "a gitlink with no matching commit")
      const before = console.error
      const lines: string[] = []
      console.error = (msg: string) => void lines.push(msg)
      try {
        const atMissing = commitSource(root, missingCommit, [ctx.trackerDir])
        assert.ok(!atMissing.files.includes("sub/src/a.ts"), "the submodule contributes no files")
        assert.equal(lines.length, 1, "reported in exactly one line")
        assert.match(lines[0] ?? "", /sub.*missing commit/)
      } finally {
        console.error = before
      }
      // The index change above is test-local bookkeeping, not a commit on HEAD: restore it so cleanup finds a clean tree.
      gitIn(root, "reset", "-q", "--hard", main2)
    } finally {
      p.cleanup()
    }
  } finally {
    removeTemp(subRoot)
  }
})

test("a project without submodules measures exactly as before: ls-files --recurse-submodules changes nothing when there is nothing to recurse into", () => {
  const p = tempProject(firstPartyPlugins({ metrics: CODE_METRICS }), { git: true })
  try {
    const { root, ctx } = p
    write(root, "src/a.ts", "export const a = 1\nexport const b = 2\n")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "c1")
    const working = workingTreeSource(root, [ctx.trackerDir])
    assert.deepEqual(working.files, ["src/a.ts"])
    const head = p.git("rev-parse", "HEAD")
    const committed = commitSource(root, head, [ctx.trackerDir])
    assert.deepEqual(committed.files, working.files)
  } finally {
    p.cleanup()
  }
})

test("plot draws an SVG panel per metric with its bound, and an HTML report beside it", async () => {
  const series = [
    {
      name: "coverage",
      unit: "%",
      better: "higher" as const,
      bound: { word: "floor", value: 80 },
      points: [{ commit: "a".repeat(40), date: "2026-09-01T10:00:00Z", value: 78 }, { commit: "b".repeat(40), date: "2026-09-05T10:00:00Z", value: 84.5 }],
    },
    { name: "complexity", better: "lower" as const, points: [{ commit: "c".repeat(40), date: "2026-09-03T10:00:00Z", value: 3 }] },
  ]
  const svg = plotSvg(series)
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
  assert.equal((svg.match(/<polyline /g) ?? []).length, 1)
  assert.match(svg, /floor 80/)
  assert.match(svg, /class="b"/)
  assert.match(svg, /aaaaaaaaaaaa 2026-09-01: 78 %/)
  assert.match(svg, /2026-09-01/)
  assert.match(svg, /prefers-color-scheme: dark/)
  const html = htmlReport(series)
  assert.match(html, /<!doctype html>/)
  assert.match(html, /<td class="better">better \(\+6.5\)<\/td>/)
  assert.ok(html.includes(plotSvg(series, "Code quality over time")))

  const p = tempProject(firstPartyPlugins({ metrics: CODE_METRICS }), { git: true })
  try {
    write(p.root, "src/a.ts", "export function f(x: number) {\n  return x\n}\n")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "one")
    await p.run("metrics", "run", "--record")
    p.output.length = 0
    assert.equal(await p.run("metrics", "plot", "loc", "complexity"), 0)
    assert.match(p.output.join("\n"), /<svg[\s\S]*loc \(lines\)[\s\S]*complexity[\s\S]*budget 3/)
    const file = join(p.ctx.trackerRoot, "quality.html")
    p.output.length = 0
    assert.equal(await p.run("metrics", "plot", "--html", "--out", file), 0)
    assert.match(readFileSync(file, "utf8"), /<!doctype html>[\s\S]*todos/)
    assert.match(p.output.join("\n"), /wrote .*quality.html/)
    await assert.rejects(p.run("metrics", "plot", "nope"), /no metric "nope"/)
  } finally {
    p.cleanup()
  }
})

test("the metrics stand beside the work: in summary, at the foot of the board and the queue, and the gate says which number fails", async () => {
  const config = { metrics: { loc: { preset: "code.loc", atMost: 1 } } }
  const p = tempProject(firstPartyPlugins({ metrics: config }), { git: true })
  try {
    const { root, ctx } = p
    const file = join(ctx.trackerRoot, DATA_FILE)
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), plugins: { metrics: { options: config } } }))
    p.output.length = 0
    assert.equal(await p.run("summary"), 0)
    assert.match(p.output.join("\n"), /── metrics\n {2}nothing recorded yet — naima metrics run --record/)
    write(root, "src/a.ts", "export const a = 1\nexport const b = 2\n")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "one")
    assert.equal(await p.run("metrics", "run", "--record"), 1)
    p.output.length = 0
    assert.equal(await p.run("summary"), 0)
    assert.match(p.output.join("\n"), /── metrics\n {2}✗ loc {2,}2 lines \(budget 1 lines\)/)
    p.output.length = 0
    assert.equal(await p.run("summary", "--json"), 0)
    assert.equal((JSON.parse(p.output.join("\n")) as { metrics: { metric: string; value: number }[] }).metrics[0]?.value, 2)
    p.output.length = 0
    assert.equal(await p.run("board", "tests"), 0)
    assert.match(p.output.join("\n"), /# [\s\S]*── metrics\n {2}✗ loc/)
    p.output.length = 0
    assert.equal(await p.run("queue"), 0)
    assert.match(p.output.join("\n"), /── metrics\n {2}✗ loc/)
    p.output.length = 0
    assert.equal(await p.run("gates", "metrics"), 0)
    assert.match(p.output.join("\n"), /metrics — The project's metrics: BLOCKED by 0\n {2}✗ loc: 2 lines, past the budget 1/)
    const gate = ctx.registry.find<{ evaluate(c: Context): { holds: boolean; reasons?: string[] } }>("gates", "metrics")!.value
    assert.deepEqual(gate.evaluate(ctx).reasons, ["loc: 2 lines, past the budget 1"])
    p.output.length = 0
    assert.equal(await p.run("metrics", "presets"), 0)
    assert.match(p.output.join("\n"), /code\.complexity\s+in process: complexity, mean; lower is better/)
    assert.match(p.output.join("\n"), /deno\.lint\s+deno lint --json/)
  } finally {
    p.cleanup()
  }
})
