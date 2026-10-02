import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { type Context, createItem, runChecks, setFields } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import rules from "../../../naima/src/plugins/rules/index.ts"

/** A rule item with its page and fields; `text` null keeps the template's placeholder. */
function rule(ctx: Context, title: string, fields: Record<string, string>, text: string | null = `Do ${title}.\n\nWhy: because.`) {
  const item = createItem(ctx, ctx.registry.types.get("rules")!, title)
  if (text !== null) writeFileSync(join(item.dir, "README.md"), `# ${title}\n\n${text}\n`)
  setFields(ctx, item, Object.entries(fields))
  ctx.reload()
  return item
}

test("naima rules lists the active rules, must before should, filtered by audience; a retired one is not shown", async () => {
  const p = tempProject([rules()])
  try {
    assert.equal(await p.run("rules"), 0)
    assert.match(p.output.join("\n"), /no active rules/)
    p.output.length = 0
    rule(p.ctx, "Prefer small commits", { audience: "everyone", strength: "should" })
    rule(p.ctx, "Quiet mode", { audience: "agents", strength: "must" })
    rule(p.ctx, "Review by hand", { audience: "people", strength: "must" })
    rule(p.ctx, "Old way", { audience: "agents", strength: "must", status: "retired" })

    assert.equal(await p.run("rules", "--audience", "agents"), 0)
    const out = p.output.join("\n")
    assert.match(out, /MUST · agents · Quiet mode \(rules\/quiet-mode\)\n {4}Do Quiet mode\.\n\n {4}Why: because\./)
    assert.ok(out.indexOf("Quiet mode") < out.indexOf("Prefer small commits"), "must before should")
    assert.doesNotMatch(out, /Review by hand|Old way/)

    p.output.length = 0
    assert.equal(await p.run("rules", "--json"), 0)
    const all = JSON.parse(p.output.join("\n")) as { title: string; strength: string }[]
    assert.deepEqual(all.map((r) => r.title), ["Quiet mode", "Review by hand", "Prefer small commits"])

    await assert.rejects(p.run("rules", "--audience", "robots"), /usage: naima rules/)
  } finally {
    p.cleanup()
  }
})

test("the rules check: every active rule has its text, a valid audience, and an enforcedBy that names a check", async () => {
  const p = tempProject([rules()])
  try {
    rule(p.ctx, "Kept", { audience: "agents", strength: "must", enforcedBy: "rules" })
    rule(p.ctx, "Retired and empty", { status: "retired" }, null)
    assert.deepEqual((await runChecks(p.ctx)).problems, [])

    rule(p.ctx, "Placeholder", { audience: "agents" }, null)
    rule(p.ctx, "Blank", { audience: "people" }, "")
    rule(p.ctx, "Nobody", {})
    rule(p.ctx, "Ghost", { audience: "everyone", enforcedBy: "no-such-check" })
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /rules\/placeholder: an active rule with no text/)
    assert.match(problems, /rules\/blank: an active rule with no text/)
    assert.match(problems, /rules\/nobody: an active rule with no audience/)
    assert.match(problems, /rules\/ghost: enforcedBy names "no-such-check", which is no check or gate/)
    assert.doesNotMatch(problems, /rules\/kept|retired-and-empty/)
  } finally {
    p.cleanup()
  }
})

test("a rule's ack is printed with it, and naima rules ends with the line every active one's joins into", async () => {
  const p = tempProject([rules()])
  try {
    rule(p.ctx, "Quiet mode", { audience: "agents", strength: "must", ack: "Quiet mode on" })
    rule(p.ctx, "Fast mode", { audience: "agents", strength: "must", ack: "Fast mode on" })
    rule(p.ctx, "No ack asked", { audience: "agents", strength: "should" })

    assert.equal(await p.run("rules", "--audience", "agents"), 0)
    const out = p.output.join("\n")
    assert.match(out, /, ack "Quiet mode on"\)/)
    assert.match(out, /\nAcknowledge: Fast mode on · Quiet mode on\n?$/)

    p.output.length = 0
    assert.equal(await p.run("rules", "--json"), 0)
    const all = JSON.parse(p.output.join("\n")) as { title: string; ack: string | null }[]
    assert.deepEqual(Object.fromEntries(all.map((r) => [r.title, r.ack])), {
      "Quiet mode": "Quiet mode on",
      "Fast mode": "Fast mode on",
      "No ack asked": null,
    })
  } finally {
    p.cleanup()
  }
})

test("rules check-ack names what a piece of text is missing, and exits 1 until every phrase is present", async () => {
  const p = tempProject([rules()])
  try {
    rule(p.ctx, "Quiet mode", { audience: "agents", strength: "must", ack: "Quiet mode on" })
    rule(p.ctx, "Fast mode", { audience: "agents", strength: "must", ack: "Fast mode on" })

    const dir = mkdtempSync(join(tmpdir(), "naima-check-ack-"))
    const reply = join(dir, "reply.txt")

    writeFileSync(reply, "Done: shipped the thing.\n")
    assert.equal(await p.run("rules", "check-ack", reply), 1)
    assert.match(p.output.join("\n"), /missing acknowledgements: Fast mode on · Quiet mode on/)

    p.output.length = 0
    writeFileSync(reply, "Acknowledge: Fast mode on · Quiet mode on\n\nDone: shipped the thing.\n")
    assert.equal(await p.run("rules", "check-ack", reply), 0)
    assert.match(p.output.join("\n"), /every acknowledgement is present/)

    await assert.rejects(p.run("rules", "check-ack"), /usage: naima rules check-ack/)
  } finally {
    p.cleanup()
  }
})
