import { newRepo, ctxAt, sh } from "./h.ts"
import { writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
const S = "/Users/vincenzo/data/local/repos/naima/src"
const { runChecks } = await import(`${S}/core/check.ts`)
const probs = (c: any) => runChecks(c.ctx).problems.map((f: any) => f.message)
// R4: property text changed after a holding run: check stays green
{
  const root = newRepo(); const m = ctxAt(root)
  writeFileSync(join(root, "model.txt"), "alpha\nbeta\n")
  await m.run("new", "properties", "Has alpha", "--set", "verifier=example-regex", "--set", "model=model.txt", "--set", "property=some alpha")
  await m.run("verify", "has-alpha")
  await m.run("set", "has-alpha", "property=some gamma")   // never verified: no line matches gamma
  console.log("R4 status:", m.ctx.repo.resolve("has-alpha").meta.status, "problems:", JSON.stringify(probs(m)))
  // R5: close a bug on a property that holds on a changed model
  await m.run("set", "has-alpha", "property=some alpha"); await m.run("verify", "has-alpha")
  await m.run("new", "bugs", "No alpha"); await m.run("set", "no-alpha", "fixedOn=2026-01-15")
  await m.run("link", "has-alpha", "verifies", "no-alpha")
  writeFileSync(join(root, "model.txt"), "beta\n")          // alpha removed: the property no longer holds
  console.log("R5 problems before close:", JSON.stringify(probs(m)))
  m.out.length = 0; const rc = await m.run("close", "no-alpha"); console.log("R5 close rc", rc, JSON.stringify(m.out))
}
// R6: an adapter that returns a verdict outside the contract erases status
{
  const root = newRepo(); const m = ctxAt(root)
  m.ctx.registry.verifiers.set("bad", { id: "bad", says: "x", verify: async () => ({ verdict: "pass" as any, output: "ok" }) })
  writeFileSync(join(root, "m.txt"), "x\n")
  await m.run("new", "properties", "P", "--set", "verifier=bad", "--set", "model=m.txt", "--set", "property=q")
  const rc = await m.run("verify", "p")
  const meta = JSON.parse(readFileSync(join(root, "naima-tracker/naima-data/properties/p/meta.json"), "utf8"))
  console.log("R6 rc", rc, "out", JSON.stringify(m.out.slice(-2)), "status in meta:", JSON.stringify(meta.status))
}
// R10: example-regex and the trailing newline
{
  const { exampleRegex } = await import(`${S}/plugins/verifier/adapters/example-regex.ts`)
  const root = newRepo(); writeFileSync(join(root, "m.txt"), "a\nb\n")
  console.log("R10 never ^$:", JSON.stringify(await exampleRegex.verify({ model: join(root, "m.txt"), property: "never ^$", options: {} }, {} as any)))
  console.log("R10 some ^$:", JSON.stringify(await exampleRegex.verify({ model: join(root, "m.txt"), property: "some ^$", options: {} }, {} as any)))
}
// R8: failed test and violated property on a gate: gate holds
{
  const gates = { v1: { title: "V1" } }
  const root = newRepo(); const m = ctxAt(root, gates)
  await m.run("new", "bugs", "Crash", "--set", "gate=v1", "--set", "fixedOn=2026-01-10")
  await m.run("new", "tests", "No crash", "--set", "gate=v1", "--set", "status=failed")
  await m.run("link", "no-crash", "verifies", "crash")
  m.out.length = 0; await m.run("gates", "v1", "--check"); console.log("R8 gates:", JSON.stringify(m.out))
}
// R12: a branch closes its own item on its own test
{
  const root = newRepo(); const m = ctxAt(root)
  sh(root, "checkout", "-q", "-b", "fix/x")
  await m.run("new", "bugs", "X broken"); await m.run("claim", "x-broken")
  await m.run("set", "x-broken", "fixedOn=2026-01-15")
  await m.run("new", "tests", "X works", "--set", "status=passed"); await m.run("link", "x-works", "verifies", "x-broken")
  m.out.length = 0; const rc = await m.run("close", "x-broken"); console.log("R12 close on own branch rc", rc, JSON.stringify(m.out))
  // R11: a beta marker naming the closed bug is reported as naming no item
  writeFileSync(join(root, "a.ts"), "// naima:beta bugs/x-broken  unproven\n")
  console.log("R11:", JSON.stringify(probs(m).filter((p: string) => p.includes("beta"))))
  console.log("R12b claims check:", JSON.stringify(runChecks(m.ctx).notes.map((n: any) => n.message)))
}
