// pack-analyses: the worked example of a non-software item-type pack — an
// analysis step proven by a reproducible run, exactly like a requirement is
// proven by a test.

import assert from "node:assert/strict"
import { test } from "node:test"
import { addLink, type Context, createItem, type Item, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import packAnalyses from "../../../naima/src/plugins/pack-analyses/index.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

const project = () => tempProject([trackers(), packAnalyses()])
const fresh = (ctx: Context, item: Item): Item => ctx.repo.resolve(item.meta.id)
const messages = async (ctx: Context, level: "problems" | "notes"): Promise<string> => (await runChecks(ctx))[level].map((f) => f.message).join("\n")

test("an analysis is confirmed only by a passing test, refuted by a failing one, and the check says which", async () => {
  const p = project()
  try {
    const { ctx } = p
    const step = createItem(ctx, typeOrThrow(ctx, "analyses"), "Table 2 rebuilt from raw data", { command: "scripts/table2.sh" })
    assert.equal(step.meta.status, "proposed")
    assert.equal(fresh(ctx, step).meta["command"], "scripts/table2.sh")

    setFields(ctx, fresh(ctx, step), [["status", "confirmed"]])
    assert.match(await messages(ctx, "problems"), /analyses\/table-2-rebuilt-from-raw-data.* is confirmed, but no test has passed/)

    const t = createItem(ctx, typeOrThrow(ctx, "tests"), "Rerun table2.sh and diff the output")
    addLink(ctx, fresh(ctx, t), "verifies", fresh(ctx, step))
    setFields(ctx, fresh(ctx, step), [["status", "proposed"]])
    setFields(ctx, fresh(ctx, t), [["status", "passed"]])
    assert.match(await messages(ctx, "notes"), /table-2-rebuilt-from-raw-data.* is reproduced — naima set .* status=confirmed/)

    setFields(ctx, fresh(ctx, step), [["status", "confirmed"]])
    assert.equal(await messages(ctx, "problems"), "")

    setFields(ctx, fresh(ctx, t), [["status", "failed"]])
    assert.match(await messages(ctx, "problems"), /is confirmed, but .* refutes it — naima set .* status=proposed/)
  } finally {
    p.cleanup()
  }
})
