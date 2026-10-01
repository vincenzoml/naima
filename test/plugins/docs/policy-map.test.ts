import assert from "node:assert/strict"
import { test } from "node:test"
import { type Command, commandGaps, runChecks } from "../../../naima/src/core/api.ts"
import { cliCommands } from "../../../naima/src/core/entry.ts"
import { firstParty, firstPartyPlugins } from "../../../naima/src/builtins.ts"
import { renderReference, unstatedEnforcement } from "../../../naima/src/plugins/docs/index.ts"
import { tempProject } from "../../core/testing.ts"

const everyPlugin = () => firstPartyPlugins(Object.fromEntries(firstParty.filter((p) => p.optIn).map((p) => [p.name, {}])))

test("a plugin command that does not say what it enforces is a note in check, named with how to add it, never a problem", async () => {
  const go = { name: "go", says: "go somewhere", usage: "go", examples: ["go"], run: () => 0 }
  assert.deepEqual(commandGaps(go), [])
  const p = tempProject([...firstPartyPlugins(), { name: "outside", says: "a plugin written before enforces", commands: [go] }])
  try {
    assert.deepEqual(unstatedEnforcement(p.ctx), ['command "go" (outside) does not say what it enforces'])
    const { problems, notes } = await runChecks(p.ctx)
    assert.ok(!problems.some((f) => f.message.includes("enforces")))
    assert.ok(notes.some((f) => f.message.startsWith('command "go" (outside) does not say what it enforces — add enforces')))
  } finally {
    p.cleanup()
  }
})

test("every command, the entry point's and every first-party plugin's, says what it enforces, and the reference maps each to it", () => {
  const p = tempProject(everyPlugin())
  try {
    const commands: Pick<Command, "name" | "enforces">[] = [...cliCommands, ...p.ctx.registry.contributions("commands").map((c) => c.value as Command)]
    assert.ok(commands.length > 40)
    for (const c of commands) assert.ok(c.enforces?.trim(), `command "${c.name}" does not say what it enforces`)
    const text = renderReference(p.ctx)
    assert.ok(text.includes("| Command | Plugin | What it does | What it enforces |"))
    for (const c of commands) {
      const row = text.split("\n").find((l) => l.startsWith(`| [\`${c.name}\`]`))
      assert.ok(row, `no row for ${c.name}`)
      assert.ok(!row.endsWith("|  |"), `the row for ${c.name} has no policy`)
    }
  } finally {
    p.cleanup()
  }
})
