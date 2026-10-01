import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { createItem, type Plugin } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import verifier, { readRun } from "../../../naima/src/plugins/verifier/index.ts"
import { type Runner, type ToolRun, voxlogicaPlugin, voxlogicaVerifier } from "../../../naima/src/plugins/verifier-voxlogica/index.ts"

// session.json and bad.json are VoxLogicA 1.3.3's own --json output on model.imgql and bad.imgql, recorded on macOS, paths replaced.
const FIXTURES = join(dirname(new URL(import.meta.url).pathname), "fixtures")
const recorded = (name: string, exit: number): ToolRun => ({ exit, stdout: readFileSync(join(FIXTURES, name), "utf8"), stderr: "" })

const gatesPoint: Plugin = {
  name: "gates-point",
  says: "declares gates",
  points: [{ id: "gates", noun: "gate", says: "a gate", key: (g: { name: string }) => g.name }],
}

function replay(answer: ToolRun): { run: Runner; calls: { program: string; args: string[]; cwd: string }[] } {
  const calls: { program: string; args: string[]; cwd: string }[] = []
  return { run: (program, args, cwd) => (calls.push({ program, args, cwd }), answer), calls }
}

const ctxStub = { root: FIXTURES } as never
const model = join(FIXTURES, "model.imgql")

test("VoxLogicA: the property is a boolean the session prints; true holds, false is violated with every printed value", async () => {
  const { run, calls } = replay(recorded("session.json", 0))
  const v = voxlogicaVerifier({ run })
  const r = await v.verify({ model, property: "square_nonempty", options: {} }, ctxStub)
  assert.equal(r.verdict, "holds")
  assert.deepEqual(calls[0], { program: "VoxLogicA", args: ["--json", "model.imgql"], cwd: FIXTURES })
  assert.match(r.output, /square_nonempty=true/)

  const no = await v.verify({ model, property: "square_small", options: {} }, ctxStub)
  assert.equal(no.verdict, "violated")
  assert.match(no.counterexample ?? "", /square_small=false/)
  assert.match(no.counterexample ?? "", /vol=9/)
})

test("VoxLogicA: a name the session does not print, or prints as a number, is an error naming what it does print", async () => {
  const { run } = replay(recorded("session.json", 0))
  const v = voxlogicaVerifier({ run })
  let r = await v.verify({ model, property: "absent", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /prints no value named "absent"/)
  assert.match(r.output, /square_nonempty/)
  r = await v.verify({ model, property: "vol", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /"vol" is a number, not a bool/)
})

test("VoxLogicA: a session the tool rejects is an error with its message; output that is not its JSON is an error", async () => {
  const { run } = replay(recorded("bad.json", 1))
  let r = await voxlogicaVerifier({ run }).verify({ model: join(FIXTURES, "bad.imgql"), property: "x", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /VoxLogicA exited 1/)
  assert.match(r.output, /Unknown identifier nosuch/)
  r = await voxlogicaVerifier({ run: replay({ exit: 0, stdout: "garbage", stderr: "" }).run }).verify({ model, property: "x", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /not the JSON VoxLogicA --json prints/)
})

test("VoxLogicA: a missing tool is an error that says how to point at it; a time limit hit is unknown", async () => {
  const v = voxlogicaVerifier({ run: replay({ exit: -1, stdout: "", stderr: "", missing: true }).run })
  const r = await v.verify({ model, property: "square_nonempty", options: {} }, ctxStub)
  assert.equal(r.verdict, "error")
  assert.match(r.output, /^tool missing: VoxLogicA/)
  assert.match(r.output, /plugins\.verifier-voxlogica\.options\.program/)
  await assert.rejects(Promise.resolve(v.version!(ctxStub)), /tool missing: VoxLogicA/)
  const slow = voxlogicaVerifier({ run: replay({ exit: -1, stdout: "", stderr: "", timedOut: true }).run })
  assert.equal((await slow.verify({ model, property: "square_nonempty", options: { timeoutSeconds: 2 } }, ctxStub)).verdict, "unknown")
})

test("VoxLogicA: the inputs are the session, the images it loads and the sessions it imports, the tool's own library left out", async () => {
  const dir = mkdtempSync(join(tmpdir(), "naima-vox-"))
  try {
    mkdirSync(join(dir, "img"))
    writeFileSync(join(dir, "img", "a.png"), "")
    writeFileSync(join(dir, "lib.imgql"), 'load b = "img/b.nii.gz"\nlet f(x) = x\n')
    writeFileSync(join(dir, "img", "b.nii.gz"), "")
    writeFileSync(join(dir, "main.imgql"), 'import "stdlib.imgql"\nimport "lib.imgql"\nload a = "img/a.png"\n// load c = "commented.png"\nprint "p" true\n')
    const v = voxlogicaVerifier({ run: replay({ exit: 0, stdout: "", stderr: "" }).run })
    assert.deepEqual(await v.inputs!({ model: join(dir, "main.imgql"), property: "p", options: {} }, ctxStub), [
      join(dir, "main.imgql"),
      join(dir, "lib.imgql"),
      join(dir, "img", "b.nii.gz"),
      join(dir, "img", "a.png"),
    ])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("VoxLogicA: the version is the option, or read beside the program, and says so when it cannot be told", async () => {
  const dir = mkdtempSync(join(tmpdir(), "naima-vox-"))
  try {
    writeFileSync(join(dir, "VoxLogicA"), "")
    writeFileSync(join(dir, "VoxLogicA.deps.json"), '{ "targets": { "x": { "VoxLogicA/1.3.3": {} } } }')
    const ok = replay({ exit: 0, stdout: "USAGE: VoxLogicA", stderr: "" }).run
    assert.equal(await voxlogicaVerifier({ program: join(dir, "VoxLogicA"), run: ok }).version!(ctxStub), "VoxLogicA 1.3.3")
    assert.equal(await voxlogicaVerifier({ program: join(dir, "VoxLogicA"), version: "1.3.3-lab", run: ok }).version!(ctxStub), "VoxLogicA 1.3.3-lab")
    rmSync(join(dir, "VoxLogicA.deps.json"))
    assert.equal(await voxlogicaVerifier({ program: join(dir, "VoxLogicA"), run: ok }).version!(ctxStub), "VoxLogicA, version unknown")
    assert.deepEqual(voxlogicaVerifier({ program: join(dir, "VoxLogicA") }).runs, [join(dir, "VoxLogicA")])
    assert.throws(() => voxlogicaPlugin({ program: 3 }), /program must be a string/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("VoxLogicA through naima verify: the property holds, its image is an input, and a changed image makes it stale", async () => {
  const { run } = replay(recorded("session.json", 0))
  const p = tempProject([verifier(), gatesPoint, voxlogicaPlugin({ version: "1.3.3" }, run)])
  try {
    copyFileSync(model, join(p.root, "model.imgql"))
    copyFileSync(join(FIXTURES, "square.png"), join(p.root, "square.png"))
    const prop = createItem(p.ctx, p.ctx.registry.types.get("properties")!, "the square is not empty", {
      verifier: "voxlogica",
      model: "model.imgql",
      property: "square_nonempty",
    })
    assert.equal(await p.run("verify", prop.slug), 0)
    const item = p.ctx.repo.resolve(prop.slug)
    assert.equal(item.meta.status, "holds")
    assert.deepEqual(readRun(item)?.inputs?.map((i) => i.path), ["model.imgql", "square.png"])
    assert.equal(readRun(item)?.toolVersion, "VoxLogicA 1.3.3")
  } finally {
    p.cleanup()
  }
})

/** The real VoxLogicA, where there is one: $VOXLOGICA, VoxLogicA on PATH, or ~/bin/VoxLogicA/VoxLogicA. */
const live = [process.env["VOXLOGICA"], "VoxLogicA", join(homedir(), "bin", "VoxLogicA", "VoxLogicA")].find((p) =>
  p && (p === "VoxLogicA" || existsSync(p)) && spawnSync(p, ["--help"], { encoding: "utf8" }).status === 0
)
test(
  "VoxLogicA live: the real tool decides the fixture session",
  { skip: !live && "VoxLogicA is not installed ($VOXLOGICA, PATH, ~/bin/VoxLogicA)" },
  async () => {
    const v = voxlogicaVerifier({ program: live! })
    const r = await v.verify({ model, property: "square_nonempty", options: {} }, ctxStub)
    assert.equal(r.verdict, "holds", r.output)
    const no = await v.verify({ model, property: "square_small", options: {} }, ctxStub)
    assert.equal(no.verdict, "violated", no.output)
  },
)
