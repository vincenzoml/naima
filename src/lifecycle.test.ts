// The item lifecycle across the first-party plugins together: what one
// plugin's write hook or status flag does to another's command.

import assert from "node:assert/strict"
import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { firstPartyPlugins } from "./builtins.ts"
import { tempProject } from "./core/testing.ts"

const project = (gates: Record<string, unknown> = {}) => tempProject(firstPartyPlugins({ gates: { gates } }), { git: true })

test("a branch does not close an item it claims on its own tests; --force, from the evidence owner, does", async () => {
  const p = project()
  try {
    p.git("checkout", "-q", "-b", "fix/x")
    assert.equal(await p.run("new", "bugs", "X broken", "--set", "fixedOn=2026-01-15"), 0)
    assert.equal(await p.run("claim", "x-broken"), 0)
    assert.equal(await p.run("new", "tests", "X works", "--set", "status=passed"), 0)
    assert.equal(await p.run("link", "x-works", "verifies", "x-broken"), 0)
    await assert.rejects(p.run("close", "x-broken"), /claimed by fix\/x, the branch you are on.*--force/)
    assert.ok(existsSync(join(p.ctx.trackerRoot, "bugs", "x-broken", "meta.json")), "refused: the item stays where it was")
    assert.equal(p.ctx.repo.resolve("x-broken").meta.status, "open", "and as it was")
    assert.equal(await p.run("close", "x-broken", "--force"), 0)
    assert.equal(p.ctx.repo.resolve("x-broken").type, "closed")
  } finally {
    p.cleanup()
  }
})

test("an item another branch claims, or nobody does, closes from here", async () => {
  const p = project()
  try {
    assert.equal(await p.run("new", "bugs", "X broken", "--set", "fixedOn=2026-01-15"), 0)
    assert.equal(await p.run("new", "tests", "X works", "--set", "status=passed"), 0)
    assert.equal(await p.run("link", "x-works", "verifies", "x-broken"), 0)
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "items")
    p.git("checkout", "-q", "-b", "fix/x")
    assert.equal(await p.run("claim", "x-broken"), 0)
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "claim")
    p.git("checkout", "-q", "main")
    assert.equal(await p.run("close", "x-broken"), 0, "fix/x claims it, not main")
  } finally {
    p.cleanup()
  }
})

test("a failed test blocks a gate that waits only for code, and so does the fix it refutes", async () => {
  const p = project({ v1: { title: "V1" } })
  try {
    assert.equal(await p.run("new", "bugs", "Crash", "--set", "gate=v1", "--set", "fixedOn=2026-01-10"), 0)
    assert.equal(await p.run("new", "tests", "No crash", "--set", "gate=v1"), 0)
    assert.equal(await p.run("link", "no-crash", "verifies", "crash"), 0)
    const gate = () =>
      p.ctx.registry.find<{ evaluate(c: typeof p.ctx): { holds: boolean; owed: unknown[]; blocking: { slug: string }[] } }>("gates", "v1")!.value.evaluate(
        p.ctx,
      )
    assert.deepEqual([gate().holds, gate().owed.length], [true, 2], "not yet performed: owed, not blocking")
    assert.equal(await p.run("set", "no-crash", "status=failed"), 0)
    assert.deepEqual([gate().holds, gate().blocking.map((i) => i.slug).sort()], [false, ["crash", "no-crash"]])
    await assert.rejects(p.run("close", "crash"), /refuted by tests\/no-crash \[failed\]/)
  } finally {
    p.cleanup()
  }
})

test("close refuses an item whose proof no longer holds: a property that holds on a model changed since", async () => {
  const p = project()
  try {
    writeFileSync(join(p.root, "model.txt"), "alpha\n")
    assert.equal(
      await p.run("new", "properties", "Has alpha", "--set", "verifier=example-regex", "--set", "model=model.txt", "--set", "property=some alpha"),
      0,
    )
    assert.equal(await p.run("verify", "has-alpha"), 0)
    assert.equal(await p.run("new", "bugs", "No alpha", "--set", "fixedOn=2026-01-15"), 0)
    assert.equal(await p.run("link", "has-alpha", "verifies", "no-alpha"), 0)
    writeFileSync(join(p.root, "model.txt"), "beta\n")
    await assert.rejects(
      p.run("close", "no-alpha"),
      /no-alpha cannot be closed: its proof does not hold now: properties\/has-alpha: holds on a model that has changed since/,
    )
    assert.equal(p.ctx.repo.resolve("no-alpha").type, "bugs")
    writeFileSync(join(p.root, "model.txt"), "alpha\n")
    assert.equal(await p.run("close", "no-alpha"), 0, "current again: it closes")
  } finally {
    p.cleanup()
  }
})

test("no first-party verifier starts a program: the launcher would allow it to every project", async () => {
  const p = project()
  try {
    assert.deepEqual(p.ctx.registry.contributions("verifiers").flatMap((c) => (c.value as { runs?: string[] }).runs ?? []), [])
    assert.equal(await p.run("runs", "--json"), 0)
    assert.equal(p.output.at(-1), "[]")
  } finally {
    p.cleanup()
  }
})
