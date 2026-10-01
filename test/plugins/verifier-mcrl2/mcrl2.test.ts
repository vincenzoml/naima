import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { test } from "node:test"
import { createItem, type Plugin, runChecks } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import { mayRun, OPT_IN } from "../../../naima/src/launcher.ts"
import { firstParty, firstPartyPlugins } from "../../../naima/src/builtins.ts"
import { composePlugins } from "../../../naima/src/core/plugins.ts"
import verifier, { readRun } from "../../../naima/src/plugins/verifier/index.ts"
import { mcrl2Plugin, mcrl2Verifier, type Runner, type ToolRun } from "../../../naima/src/plugins/verifier-mcrl2/index.ts"

const FIXTURES = join(dirname(new URL(import.meta.url).pathname), "fixtures")
const fixtures = JSON.parse(readFileSync(join(FIXTURES, "tools.json"), "utf8")) as Record<string, unknown>
const tools = (name: string): ToolRun => fixtures[name] as ToolRun
const evidence = fixtures["evidence"] as string

const gatesPoint: Plugin = {
  name: "gates-point",
  says: "declares gates",
  points: [{ id: "gates", noun: "gate", says: "a gate", key: (g: { name: string }) => g.name }],
}

interface Call {
  program: string
  args: string[]
  cwd: string
}

/** A runner that replays the fixtures: `pbessolve` answers `answer`; `lps2lts` writes the evidence it was asked to print. */
function replay(answer: "pbessolveTrue" | "pbessolveFalse", over: Partial<Record<string, ToolRun>> = {}): { run: Runner; calls: Call[]; formulas: string[] } {
  const calls: Call[] = []
  const formulas: string[] = []
  const run: Runner = (program, args, cwd) => {
    calls.push({ program, args, cwd })
    const tool = basename(program)
    if (args[0] === "--version") return over["version"] ?? tools("version")
    const replaced = over[tool]
    if (replaced) return replaced
    if (tool === "lps2pbes") {
      const f = args.find((a) => a.startsWith("--formula="))
      if (f) formulas.push(readFileSync(f.slice("--formula=".length), "utf8"))
    }
    if (tool === "pbessolve") return tools(answer)
    if (tool === "lps2lts") writeFileSync(args[args.length - 1]!, evidence)
    return tools(tool) ?? { exit: 0, stdout: "", stderr: "" }
  }
  return { run, calls, formulas }
}

const missing: ToolRun = { exit: -1, stdout: "", stderr: "", missing: true }
const ctxStub = { root: FIXTURES } as never
const model = join(FIXTURES, "switch.mcrl2")

test("mCRL2: a formula that holds runs mcrl22lps, lps2pbes with evidence, pbessolve, and holds", async () => {
  const { run, calls, formulas } = replay("pbessolveTrue")
  const v = mcrl2Verifier({ run })
  const r = await v.verify({ model, property: "[true*]<true>true", options: {} }, ctxStub)
  assert.equal(r.verdict, "holds")
  assert.deepEqual(calls.map((c) => basename(c.program)), ["mcrl22lps", "lps2pbes", "pbessolve"])
  assert.equal(calls[0]!.args[0], model)
  assert.ok(calls[1]!.args.includes("--counter-example"), "lps2pbes is asked for the evidence pbessolve needs")
  assert.deepEqual(formulas, ["[true*]<true>true\n"], "an inline formula is handed to lps2pbes as a file")
  assert.ok(calls[2]!.args.some((a) => a.startsWith("--evidence-file=")))
  assert.match(r.output, /pbessolve[^\n]*\n[\s\S]*true/)
  assert.equal(r.counterexample, undefined)
})

test("mCRL2: a violated formula returns pbessolve's evidence, printed by lps2lts, as the counterexample", async () => {
  const { run, calls } = replay("pbessolveFalse")
  const r = await mcrl2Verifier({ run }).verify({ model, property: "[true*]<true>true", options: {} }, ctxStub)
  assert.equal(r.verdict, "violated")
  assert.deepEqual(calls.map((c) => basename(c.program)), ["mcrl22lps", "lps2pbes", "pbessolve", "lps2lts"])
  assert.equal(r.counterexample, evidence)
})

test("mCRL2: a missing tool is an error that says which and how to get it, never a verdict", async () => {
  const { run } = replay("pbessolveTrue", { mcrl22lps: missing, version: missing })
  const v = mcrl2Verifier({ run })
  const r = await v.verify({ model, property: "true", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /^tool missing: mcrl22lps/)
  assert.match(r.output, /mcrl2\.org/)
  await assert.rejects(Promise.resolve(v.version!(ctxStub)), /tool missing: mcrl22lps/)
})

test("mCRL2: a tool that fails is an error with its output; a time limit hit is unknown; pbessolve's other answers are unknown", async () => {
  const bad = replay("pbessolveTrue", { mcrl22lps: tools("mcrl22lpsSyntaxError") })
  let r = await mcrl2Verifier({ run: bad.run }).verify({ model, property: "true", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /mcrl22lps exited 1/)
  assert.match(r.output, /syntax error at line 2/)
  assert.equal(bad.calls.length, 1, "nothing runs after the step that failed")

  const slow = replay("pbessolveTrue", { pbessolve: { exit: -1, stdout: "", stderr: "", timedOut: true } })
  r = await mcrl2Verifier({ run: slow.run }).verify({ model, property: "true", options: { timeoutSeconds: 5 } }, ctxStub)
  assert.equal(r.verdict, "unknown")
  assert.match(r.output, /pbessolve did not finish in 5 s/)

  const odd = replay("pbessolveTrue", { pbessolve: { exit: 0, stdout: "maybe\n", stderr: "" } })
  r = await mcrl2Verifier({ run: odd.run }).verify({ model, property: "true", options: {} }, ctxStub)
  assert.equal(r.verdict, "unknown")
})

test("mCRL2: a property naming an .mcf file reads it, from the project root, and declares it as an input", async () => {
  const { run, calls } = replay("pbessolveTrue")
  const v = mcrl2Verifier({ run })
  const req = { model, property: "no-deadlock.mcf", options: {} }
  assert.equal((await v.verify(req, ctxStub)).verdict, "holds")
  assert.ok(calls[1]!.args.includes(`--formula=${join(FIXTURES, "no-deadlock.mcf")}`))
  assert.deepEqual(await v.inputs!(req, ctxStub), [model, join(FIXTURES, "no-deadlock.mcf")])
  assert.deepEqual(await v.inputs!({ model, property: "true", options: {} }, ctxStub), [model])
  const r = await v.verify({ model, property: "absent.mcf", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /absent\.mcf does not exist/)
})

test("mCRL2: the tools come from PATH, or from the bin option, and are declared as the programs it runs", async () => {
  assert.deepEqual(mcrl2Verifier().runs, ["mcrl22lps", "lps2pbes", "pbessolve", "lps2lts"])
  const { run, calls } = replay("pbessolveTrue")
  const v = mcrl2Verifier({ bin: "/opt/mcrl2/bin", run })
  assert.deepEqual(v.runs, ["/opt/mcrl2/bin/mcrl22lps", "/opt/mcrl2/bin/lps2pbes", "/opt/mcrl2/bin/pbessolve", "/opt/mcrl2/bin/lps2lts"])
  assert.equal(await v.version!(ctxStub), "mcrl22lps mCRL2 toolset 202307.1 (Release)")
  assert.equal(calls[0]!.program, "/opt/mcrl2/bin/mcrl22lps")
  assert.throws(() => mcrl2Plugin({ bin: "relative/bin" }), /bin must be an absolute path/)
})

test("mCRL2 through naima verify: the run records the tool version; a missing tool records an error run, not a crash", async () => {
  const ok = replay("pbessolveTrue")
  let p = tempProject([verifier(), gatesPoint, mcrl2Plugin({}, ok.run)])
  try {
    copyFileSync(model, join(p.root, "switch.mcrl2"))
    const prop = createItem(p.ctx, p.ctx.registry.types.get("properties")!, "the switch never deadlocks", {
      verifier: "mcrl2",
      model: "switch.mcrl2",
      property: "[true*]<true>true",
    })
    assert.equal(await p.run("verify", prop.slug), 0)
    const item = p.ctx.repo.resolve(prop.slug)
    assert.equal(item.meta.status, "holds")
    assert.equal(readRun(item)?.toolVersion, "mcrl22lps mCRL2 toolset 202307.1 (Release)")
  } finally {
    p.cleanup()
  }

  const gone = replay("pbessolveTrue", { mcrl22lps: missing, version: missing })
  p = tempProject([verifier(), gatesPoint, mcrl2Plugin({}, gone.run)])
  try {
    copyFileSync(model, join(p.root, "switch.mcrl2"))
    const prop = createItem(p.ctx, p.ctx.registry.types.get("properties")!, "the switch never deadlocks", {
      verifier: "mcrl2",
      model: "switch.mcrl2",
      property: "[true*]<true>true",
    })
    assert.equal(await p.run("verify", prop.slug), 1)
    const item = p.ctx.repo.resolve(prop.slug)
    assert.equal(item.meta.status, "error")
    assert.match(readRun(item)?.output ?? "", /tool missing: mcrl22lps/)
  } finally {
    p.cleanup()
  }
})

const onPath = spawnSync("mcrl22lps", ["--version"], { encoding: "utf8" }).status === 0
test("mCRL2 live: the real tools decide the fixture model", { skip: !onPath && "mCRL2 is not on PATH (mcrl22lps --version failed)" }, async () => {
  const v = mcrl2Verifier()
  assert.equal((await v.verify({ model, property: "no-deadlock.mcf", options: {} }, ctxStub)).verdict, "holds")
  const r = await v.verify({ model, property: "[true*][on]false", options: {} }, ctxStub)
  assert.equal(r.verdict, "violated")
  assert.ok(r.counterexample)
})

test("the model-checker plugins are opt-in: loaded, and their tools granted by the launcher, only where naima.json names them", async () => {
  assert.deepEqual(firstParty.filter((p) => p.optIn).map((p) => p.name), [...OPT_IN])
  const where = { program: "/nowhere", root: "/nowhere", tracker: "/nowhere" }
  const entry = (enabled: boolean) => ({ enabled, options: {}, checks: {} })
  const loaded = async (plugins: Record<string, ReturnType<typeof entry>>) =>
    (await composePlugins(where, { plugins, rename: {}, extends: [] } as never, firstParty)).map((p) => p.name)
  assert.ok(!(await loaded({})).includes("verifier-mcrl2"))
  assert.ok((await loaded({ "verifier-mcrl2": entry(true) })).includes("verifier-mcrl2"))
  assert.ok(!(await loaded({ "verifier-voxlogica": entry(false) })).includes("verifier-voxlogica"))
  assert.ok(!firstPartyPlugins().some((p) => p.name.startsWith("verifier-")))
  const dir = mkdtempSync(join(tmpdir(), "naima-data-"))
  try {
    const say = (plugins: unknown) => writeFileSync(join(dir, "naima.json"), JSON.stringify({ plugins }))
    say({})
    assert.equal(mayRun(dir), false)
    say({ "verifier-mcrl2": { options: { bin: "/opt/mcrl2/bin" } } })
    assert.equal(mayRun(dir), true)
    say({ "verifier-voxlogica": { enabled: false } })
    assert.equal(mayRun(dir), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("switched on, both model-checker plugins are documented as every loaded plugin must be", async () => {
  const p = tempProject(firstPartyPlugins({ "verifier-mcrl2": {}, "verifier-voxlogica": {} }))
  try {
    const found = (await runChecks(p.ctx)).problems.map((f) => f.message).filter((m) => /mcrl2|voxlogica/i.test(m))
    assert.deepEqual(found, [])
    assert.deepEqual(p.ctx.registry.contributions("verifiers").map((c) => c.name).sort(), ["example-regex", "mcrl2", "voxlogica"])
  } finally {
    p.cleanup()
  }
})
