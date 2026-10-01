import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, type Plugin, runChecks } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import { exampleRegex } from "../../../naima/src/plugins/verifier/adapters/example-regex.ts"
import verifier, { readRun, type Verifier } from "../../../naima/src/plugins/verifier/index.ts"

/** Whatever plugin declares the gates point: plugins never import each other, so a stand-in declares it here. */
const gatesPoint: Plugin = {
  name: "gates-point",
  says: "declares gates",
  points: [{ id: "gates", noun: "gate", says: "a gate", key: (g: { name: string }) => g.name }],
}

test("a run is attached as evidence, with the counterexample and the model's hash", async () => {
  const p = tempProject([verifier(), gatesPoint])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "model.txt"), "init x = 0\nnext x' = x + 1\n")
    const prop = createItem(ctx, ctx.registry.types.get("properties")!, "x is never negative", {
      verifier: "example-regex",
      model: "model.txt",
      property: "never x = -",
    })
    assert.equal(await p.run("verify", prop.slug), 0)
    let item = ctx.repo.resolve(prop.slug)
    assert.equal(item.meta.status, "holds")
    assert.equal(readRun(item)?.verdict, "holds")
    assert.deepEqual((await runChecks(ctx)).problems, [])
    assert.ok(ctx.registry.find<{ evaluate(c: typeof ctx): { holds: boolean } }>("gates", "properties")!.value.evaluate(ctx).holds)

    // the model changes: the old verdict is no longer evidence
    writeFileSync(join(p.root, "model.txt"), "init x = 0\nnext x' = x - 1\nassume x = -1\n")
    assert.match((await runChecks(ctx)).problems.map((f) => f.message).join(), /model that has changed/)

    assert.equal(await p.run("verify", "--all"), 1)
    item = ctx.repo.resolve(prop.slug)
    assert.equal(item.meta.status, "violated")
    const files = readdirSync(join(item.dir, "attachments"))
    const cex = files.find((f) => f.startsWith("counterexample-"))
    assert.ok(cex)
    assert.equal(readFileSync(join(item.dir, "attachments", cex), "utf8"), "3: assume x = -1\n")
    assert.deepEqual((await runChecks(ctx)).problems, [])
    assert.equal(ctx.registry.find<{ evaluate(c: typeof ctx): { holds: boolean } }>("gates", "properties")!.value.evaluate(ctx).holds, false)
  } finally {
    p.cleanup()
  }
})

test("adapters come from any plugin; a missing verifier or model is a problem", async () => {
  const always: Verifier = { id: "always", says: "", verify: () => Promise.resolve({ verdict: "holds", output: "ok" }) }
  const extra: Plugin = { name: "extra", says: "", contributes: { verifiers: [always] } }
  const p = tempProject([verifier(), extra])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "m"), "")
    const type = ctx.registry.types.get("properties")!
    const ok = createItem(ctx, type, "fine", { verifier: "always", model: "m", property: "anything" })
    createItem(ctx, type, "broken", { verifier: "nope", model: "gone", property: "p" })
    assert.equal(await p.run("verify", ok.slug), 0)
    const problems = (await runChecks(ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /verifier "nope" is not loaded/)
    assert.match(problems, /model gone does not exist/)
    await assert.rejects(() => p.run("verify", "broken"), /no verifier "nope"/)
  } finally {
    p.cleanup()
  }
})

test("the example adapter reads lines as written: no phantom last line, no trailing \\r", async () => {
  const dir = mkdtempSync(join(tmpdir(), "naima-regex-"))
  try {
    const run = async (text: string, property: string) => {
      writeFileSync(join(dir, "m.txt"), text)
      return (await exampleRegex.verify({ model: join(dir, "m.txt"), property, options: {} }, {} as never)).verdict
    }
    assert.equal(await run("a\nb\n", "never ^$"), "holds")
    assert.equal(await run("a\r\nb\r\n", "never ^$"), "holds")
    assert.equal(await run("a\r\nb\r\n", "some ^b$"), "holds")
    assert.equal(await run("a\n\nb\n", "never ^$"), "violated")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("an adapter outside the contract gives a property in error with a readable output, never a status-less one", async () => {
  const bad = (id: string, verify: () => Promise<unknown>): Verifier => ({ id, says: "", verify: verify as Verifier["verify"] })
  const extra: Plugin = {
    name: "extra",
    says: "",
    contributes: {
      verifiers: [
        bad("pass", () => Promise.resolve({ verdict: "pass", output: "fine" })),
        bad("silent", () => Promise.resolve({ verdict: "holds" })),
        bad("nothing", () => Promise.resolve(undefined)),
        bad("throws", () => Promise.reject("a string, not an Error")),
      ],
    },
  }
  const p = tempProject([verifier(), extra])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "m"), "")
    for (
      const [id, output] of [["pass", /verdict "pass", outside the contract/], ["silent", /no string output/], ["nothing", /not a result/], [
        "throws",
        /a string, not an Error/,
      ]] as const
    ) {
      const item = createItem(ctx, ctx.registry.types.get("properties")!, `by ${id}`, { verifier: id, model: "m", property: "p" })
      assert.equal(await p.run("verify", item.slug), 1, id)
      const after = ctx.repo.resolve(item.slug)
      assert.equal(after.meta.status, "error", id)
      assert.match(readRun(after)?.output ?? "", output, id)
    }
    assert.deepEqual((await runChecks(ctx)).problems, [])
  } finally {
    p.cleanup()
  }
})

test("a property holds only for what was run: a changed property, verifier, model path or options is reported", async () => {
  const other: Verifier = { id: "other", says: "", verify: () => Promise.resolve({ verdict: "holds", output: "ok" }) }
  const p = tempProject([verifier(), { name: "extra", says: "", contributes: { verifiers: [other] } }])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "model.txt"), "alpha\nbeta\n")
    writeFileSync(join(p.root, "copy.txt"), "alpha\nbeta\n")
    const prop = createItem(ctx, ctx.registry.types.get("properties")!, "has beta", {
      verifier: "example-regex",
      model: "model.txt",
      property: "some beta",
      verifierOptions: { depth: 1 },
    })
    assert.equal(await p.run("verify", prop.slug), 0)
    const problems = async () => (await runChecks(ctx)).problems.map((f) => f.message).join("\n")
    assert.equal(await problems(), "")
    const path = join(prop.dir, "meta.json")
    const held = JSON.parse(readFileSync(path, "utf8"))
    for (
      const [change, why] of [
        [{ property: "some gamma" }, /holds for property "some beta", not "some gamma"/],
        [{ verifier: "other" }, /holds by verifier "example-regex", not "other"/],
        [{ model: "copy.txt" }, /holds on model model\.txt, not copy\.txt/],
        [{ verifierOptions: { depth: 2 } }, /holds with other verifierOptions/],
      ] as const
    ) {
      writeFileSync(path, JSON.stringify({ ...held, ...change }))
      p.ctx.reload()
      assert.match(await problems(), why)
      assert.match(await problems(), /run naima verify again/)
    }
  } finally {
    p.cleanup()
  }
})

test("a property's inputs are checked: its options are a declared field, its paths stay inside, its run record is read with care", async () => {
  const p = tempProject([verifier()])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "m"), "x\n")
    const type = ctx.registry.types.get("properties")!
    assert.equal(ctx.registry.fields.get("verifierOptions")?.kind, "object")
    assert.equal(
      await p.run(
        "new",
        "properties",
        "has options",
        "--set",
        'verifierOptions={"depth":2}',
        "--set",
        "verifier=example-regex",
        "--set",
        "model=m",
        "--set",
        "property=some x",
      ),
      0,
    )
    assert.deepEqual(ctx.repo.resolve("has-options").meta["verifierOptions"], { depth: 2 })
    await assert.rejects(p.run("set", "has-options", "verifierOptions=[1]"), /verifierOptions: "\[1\]" is not a JSON object/)

    const escape = createItem(ctx, type, "escapes", { verifier: "example-regex", model: "../../../../etc/passwd", property: "some root" })
    await assert.rejects(p.run("verify", escape.slug), /model \.\.\/\.\.\/\.\.\/\.\.\/etc\/passwd is outside the project/)
    const absolute = createItem(ctx, type, "absolute", { verifier: "example-regex", model: "/etc/passwd", property: "some root" })
    await assert.rejects(p.run("verify", absolute.slug), /model \/etc\/passwd is outside the project/)

    const ok = createItem(ctx, type, "fine", { verifier: "example-regex", model: "m", property: "some x" })
    assert.equal(await p.run("verify", ok.slug), 0)
    const path = join(ok.dir, "meta.json")
    const meta = JSON.parse(readFileSync(path, "utf8"))
    writeFileSync(join(ok.dir, "attachments", meta.lastRun), JSON.stringify({ verdict: "holds" }))
    const problems = async () => (await runChecks(ctx)).problems.map((f) => f.message).join("\n")
    assert.match(await problems(), /fine: holds, but its run record .* is malformed/)
    writeFileSync(path, JSON.stringify({ ...meta, lastRun: "../../escapes/meta.json" }))
    p.ctx.reload()
    assert.match(await problems(), /fine: lastRun "\.\.\/\.\.\/escapes\/meta\.json" is not a file name in attachments\//)
    assert.match(await problems(), /escapes: model \.\.\/\.\.\/\.\.\/\.\.\/etc\/passwd is outside the project/)
  } finally {
    p.cleanup()
  }
})

test("changing what a property was verified on sets it back to open, by any command", async () => {
  const p = tempProject([verifier()])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "model.txt"), "alpha\nbeta\n")
    writeFileSync(join(p.root, "copy.txt"), "alpha\nbeta\n")
    const prop = createItem(ctx, ctx.registry.types.get("properties")!, "has beta", { verifier: "example-regex", model: "model.txt", property: "some beta" })
    for (const change of ["property=some alpha", "model=copy.txt", 'verifierOptions={"depth":2}']) {
      assert.equal(await p.run("verify", prop.slug), 0)
      assert.equal(ctx.repo.resolve(prop.slug).meta.status, "holds")
      assert.equal(await p.run("set", prop.slug, change), 0)
      assert.equal(ctx.repo.resolve(prop.slug).meta.status, "open", change)
      assert.deepEqual((await runChecks(ctx)).problems, [], "open claims nothing, so nothing is stale")
    }
    assert.equal(await p.run("verify", prop.slug), 0)
    assert.equal(await p.run("set", prop.slug, "title=Has a beta"), 0)
    assert.equal(ctx.repo.resolve(prop.slug).meta.status, "holds", "a change to anything else keeps the verdict")
  } finally {
    p.cleanup()
  }
})

test("holds set by hand is refused; naima verify still writes it", async () => {
  const p = tempProject([verifier()])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "model.txt"), "alpha\n")
    const type = ctx.registry.types.get("properties")!
    const prop = createItem(ctx, type, "has alpha", { verifier: "example-regex", model: "model.txt", property: "some alpha" })
    await assert.rejects(p.run("set", prop.slug, "status=holds"), /holds is written by naima verify.*naima verify has-alpha/)
    assert.equal(ctx.repo.resolve(prop.slug).meta.status, "open")
    assert.throws(() => createItem(ctx, type, "born holding", { status: "holds" }), /holds is written by naima verify/)
    assert.equal(await p.run("verify", prop.slug), 0)
    assert.equal(ctx.repo.resolve(prop.slug).meta.status, "holds")
  } finally {
    p.cleanup()
  }
})

test("a hand edit of meta.json to holds, with no run, fails naima check as naima set would have refused it", async () => {
  const p = tempProject([verifier()])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "model.txt"), "alpha\n")
    const prop = createItem(ctx, ctx.registry.types.get("properties")!, "has alpha", { verifier: "example-regex", model: "model.txt", property: "some alpha" })
    const path = join(prop.dir, "meta.json")
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), status: "holds" }))
    p.ctx.reload()
    assert.match((await runChecks(ctx)).problems.map((f) => f.message).join("\n"), /has-alpha: holds, but carries no run/)
  } finally {
    p.cleanup()
  }
})

test("the run keeps one digest over every input and the tool version: a change to an included file reopens the property", async () => {
  const p = tempProject([verifier()])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "model.txt"), "#include parts/part.txt\nalpha\n")
    rmSync(join(p.root, "parts"), { recursive: true, force: true })
    mkdirSync(join(p.root, "parts"))
    writeFileSync(join(p.root, "parts", "part.txt"), "beta\n")
    const prop = createItem(ctx, ctx.registry.types.get("properties")!, "has beta", { verifier: "example-regex", model: "model.txt", property: "some beta" })
    assert.equal(await p.run("verify", prop.slug), 0, "the included file's lines are the model's")
    const run = readRun(ctx.repo.resolve(prop.slug))!
    assert.deepEqual(run.inputs?.map((i) => i.path), ["model.txt", "parts/part.txt"])
    assert.equal(typeof run.toolVersion, "string")
    assert.match(run.inputsSha256 ?? "", /^[0-9a-f]{64}$/)
    const problems = async () => (await runChecks(ctx)).problems.map((f) => f.message).join("\n")
    assert.equal(await problems(), "")

    writeFileSync(join(p.root, "parts", "part.txt"), "gamma\n")
    assert.match(await problems(), /has-beta: holds on inputs that have changed since: parts\/part\.txt — run naima verify again/)
    assert.equal(await p.run("verify", prop.slug), 1)
    assert.equal(ctx.repo.resolve(prop.slug).meta.status, "violated")
    assert.equal(await problems(), "")
  } finally {
    p.cleanup()
  }
})

test("a property run by another version of its tool is reported stale", async () => {
  let version = "1.0"
  const tool: Verifier = {
    id: "tool",
    says: "a stand-in with a version",
    version: () => Promise.resolve(version),
    verify: () => Promise.resolve({ verdict: "holds", output: "ok" }),
  }
  const p = tempProject([verifier(), { name: "extra", says: "", contributes: { verifiers: [tool] } }])
  try {
    const { ctx } = p
    writeFileSync(join(p.root, "m"), "x\n")
    const prop = createItem(ctx, ctx.registry.types.get("properties")!, "fine", { verifier: "tool", model: "m", property: "anything" })
    assert.equal(await p.run("verify", prop.slug), 0)
    assert.equal(readRun(ctx.repo.resolve(prop.slug))?.toolVersion, "1.0")
    const problems = async () => (await runChecks(ctx)).problems.map((f) => f.message).join("\n")
    assert.equal(await problems(), "")
    version = "2.0"
    assert.match(await problems(), /fine: holds by tool version "1\.0", not "2\.0" — run naima verify again/)
    assert.equal(await p.run("verify", prop.slug), 0)
    assert.equal(await problems(), "")
  } finally {
    p.cleanup()
  }
})
