// pack-papers: the second worked example of a non-software item-type pack —
// a paper's section proven by a co-author's review rather than by a test.

import assert from "node:assert/strict"
import { test } from "node:test"
import { addLink, type Context, createItem, type Item, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import packPapers from "../../../naima/src/plugins/pack-papers/index.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

const project = () => tempProject([trackers(), packPapers()])
const fresh = (ctx: Context, item: Item): Item => ctx.repo.resolve(item.meta.id)
const messages = async (ctx: Context, level: "problems" | "notes"): Promise<string> => (await runChecks(ctx))[level].map((f) => f.message).join("\n")

test("a section is confirmed only by an answering review, disputed by a standing one, and the check says which", async () => {
  const p = project()
  try {
    const { ctx } = p
    const section = createItem(ctx, typeOrThrow(ctx, "sections"), "Related work, drafted to the agreed outline")
    assert.equal(section.meta.status, "proposed")

    setFields(ctx, fresh(ctx, section), [["status", "confirmed"]])
    assert.match(await messages(ctx, "problems"), /sections\/related-work-drafted-agreed-outline.* is confirmed, but no review has answered/)

    const r = createItem(ctx, typeOrThrow(ctx, "reviews"), "Laura reviews related work", { reviewer: "Laura" })
    addLink(ctx, fresh(ctx, r), "verifies", fresh(ctx, section))
    setFields(ctx, fresh(ctx, section), [["status", "proposed"]])
    setFields(ctx, fresh(ctx, r), [["status", "answered"]])
    assert.match(await messages(ctx, "notes"), /related-work-drafted-agreed-outline.* matches the outline — naima set .* status=confirmed/)

    setFields(ctx, fresh(ctx, section), [["status", "confirmed"]])
    assert.equal(await messages(ctx, "problems"), "")

    setFields(ctx, fresh(ctx, r), [["status", "standing"]])
    assert.match(await messages(ctx, "problems"), /is confirmed, but .* stands with an unanswered objection — naima set .* status=disputed/)
  } finally {
    p.cleanup()
  }
})
