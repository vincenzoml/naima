// Planning: requirements proven by tests, specifications versioned name-vN, decisions recorded once, releases staged.

import assert from "node:assert/strict"
import { test } from "node:test"
import { addLink, type Context, createItem, type Item, readReadme, runChecks, setFields, typeOrThrow } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import planning, { STAGES } from "../../../naima/src/plugins/planning/index.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

const project = () => tempProject([trackers(), planning()])
const make = (ctx: Context, type: string, title: string): Item => createItem(ctx, typeOrThrow(ctx, type), title)
const fresh = (ctx: Context, item: Item): Item => ctx.repo.resolve(`${item.type}/${item.slug}`)
const messages = async (ctx: Context, level: "problems" | "notes"): Promise<string> => (await runChecks(ctx))[level].map((f) => f.message).join("\n")

test("a requirement is met only by a passing proof; the check and the requirements view say where each stands", async () => {
  const p = project()
  try {
    const { ctx } = p
    const req = make(ctx, "requirements", "Every number in table 2 comes from the raw data")
    assert.equal(req.meta.status, "stated")
    assert.match(await messages(ctx, "notes"), /requirements\/every-number-table-2.*nothing delivers or proves it/)

    const feature = make(ctx, "features", "Table 2 script")
    addLink(ctx, fresh(ctx, feature), "satisfies", fresh(ctx, req))
    setFields(ctx, fresh(ctx, req), [["status", "met"]])
    assert.match(await messages(ctx, "problems"), /requirements\/every-number-table-2.* is met, but no proof has passed/)

    const proof = make(ctx, "tests", "Table 2 rebuilt from raw data matches")
    addLink(ctx, fresh(ctx, proof), "verifies", fresh(ctx, req))
    setFields(ctx, fresh(ctx, req), [["status", "stated"]])
    setFields(ctx, fresh(ctx, proof), [["status", "passed"]])
    assert.match(await messages(ctx, "notes"), /requirements\/every-number-table-2.* is proven — naima set .* status=met/)

    setFields(ctx, fresh(ctx, req), [["status", "met"]])
    assert.doesNotMatch(await messages(ctx, "problems") + (await messages(ctx, "notes")), /every-number-table-2/)

    assert.equal(await p.run("view", "--json", "requirements"), 0)
    const rows = JSON.parse(p.output.join("\n")) as { requirement: string; status: string; proven: string; satisfiedBy: string[]; provenBy: string[] }[]
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.proven, "proven")
    assert.deepEqual(rows[0]?.satisfiedBy, [`features/${feature.slug}`])
    assert.deepEqual(rows[0]?.provenBy, [`tests/${proof.slug}`])

    setFields(ctx, fresh(ctx, proof), [["status", "failed"]])
    assert.match(await messages(ctx, "problems"), /is met, but .* refutes it/)
    p.output.length = 0
    assert.equal(await p.run("view", "requirements"), 0)
    assert.match(p.output.join("\n"), /✗ requirements\/every-number-table-2.*\[met\] refuted/)
  } finally {
    p.cleanup()
  }
})

test("a spec is versioned name-vN: a revision copies the page, supersedes the old, and one version per name is current", async () => {
  const p = project()
  try {
    const { ctx } = p
    const v1 = make(ctx, "specs", "Export format")
    assert.equal(v1.meta["spec"], "export-format")
    assert.equal(v1.meta["version"], 1)
    assert.equal(v1.meta.status, "draft")
    setFields(ctx, fresh(ctx, v1), [["status", "current"]])

    assert.equal(await p.run("spec", "revise", `specs/${v1.slug}`), 0)
    const v2 = ctx.repo.items.find((i) => i.type === "specs" && i.meta["version"] === 2)
    assert.ok(v2, "a second version exists")
    assert.equal(v2.meta["spec"], "export-format")
    assert.equal(v2.meta.status, "draft")
    assert.equal(v2.meta.title, "Export format v2")
    assert.equal(readReadme(v2).replace(/^#[^\n]*\n/, ""), readReadme(fresh(ctx, v1)).replace(/^#[^\n]*\n/, ""))
    assert.deepEqual(ctx.repo.linksOf(v2).filter((l) => l.rel === "supersedes").map((l) => l.id), [v1.meta.id])
    assert.match(p.output.join("\n"), /export-format-v2 .*supersedes export-format-v1/)

    const feature = make(ctx, "features", "CSV export")
    addLink(ctx, fresh(ctx, feature), "specified-by", fresh(ctx, v1))
    setFields(ctx, fresh(ctx, v2), [["status", "current"]])
    const problems = await messages(ctx, "problems")
    assert.match(problems, /export-format has 2 current versions/)
    assert.match(problems, /export-format-v1 is superseded by export-format-v2, which is current — naima set .* status=superseded/)

    setFields(ctx, fresh(ctx, v1), [["status", "superseded"]])
    assert.doesNotMatch(await messages(ctx, "problems"), /export-format/)
    assert.match(await messages(ctx, "notes"), /features\/csv-export.* follows export-format-v1, superseded by export-format-v2/)

    p.output.length = 0
    assert.equal(await p.run("spec", "--json"), 0)
    const rows = JSON.parse(p.output.join("\n")) as { spec: string; current: string | null; versions: number; followedBy: string[] }[]
    assert.deepEqual(rows.map((r) => [r.spec, r.current, r.versions]), [["export-format", "export-format-v2", 2]])

    await assert.rejects(p.run("spec", "revise", `features/${feature.slug}`), /is not a spec/)
  } finally {
    p.cleanup()
  }
})

test("a decision is dated and settled on creation, found by a search before asking, and a human item it settles is noted", async () => {
  const p = project()
  try {
    const { ctx } = p
    const d1 = make(ctx, "decisions", "The paper targets the journal, not the conference")
    assert.equal(d1.meta.status, "settled")
    assert.equal(d1.meta["decidedOn"], "2026-01-15")

    const ask = make(ctx, "todos", "Choose where the paper goes")
    setFields(ctx, fresh(ctx, ask), [["runBy", "human"], ["humanBecause", "decision"]])
    addLink(ctx, fresh(ctx, d1), "settles", fresh(ctx, ask))
    assert.match(await messages(ctx, "notes"), /todos\/choose-where-paper-goes.* waits on a decision that decisions\/.* settled on 2026-01-15 — act on it/)

    assert.equal(await p.run("decisions", "journal"), 0)
    assert.match(p.output.join("\n"), /decisions\/paper-targets-journal-not-conference.*2026-01-15/)
    p.output.length = 0
    assert.equal(await p.run("decisions", "workshop"), 0)
    assert.match(p.output.join("\n"), /no settled decision matches "workshop" — ask the owner, then record the answer: naima new decisions/)

    const d2 = make(ctx, "decisions", "The paper targets the workshop")
    addLink(ctx, fresh(ctx, d2), "supersedes", fresh(ctx, d1))
    assert.match(
      await messages(ctx, "problems"),
      /decisions\/paper-targets-journal.* is superseded by decisions\/paper-targets-workshop.*, which is settled — naima set .* status=superseded/,
    )
    setFields(ctx, fresh(ctx, d1), [["status", "superseded"]])
    assert.doesNotMatch(await messages(ctx, "problems"), /decisions\//)

    p.output.length = 0
    assert.equal(await p.run("decisions", "--json", "paper"), 0)
    assert.deepEqual((JSON.parse(p.output.join("\n")) as { item: string }[]).map((d) => d.item), [`decisions/${d2.slug}`])
    p.output.length = 0
    assert.equal(await p.run("decisions", "--all", "--json", "paper"), 0)
    assert.equal((JSON.parse(p.output.join("\n")) as unknown[]).length, 2)

    setFields(ctx, fresh(ctx, d2), [["standing", "true"]])
    p.output.length = 0
    assert.equal(await p.run("decisions"), 0)
    assert.match(p.output.join("\n"), /standing permission/)
  } finally {
    p.cleanup()
  }
})

test("a release is marked released only once every stage is recorded, or skipped and said by whom", async () => {
  const p = project()
  try {
    const { ctx } = p
    const rel = make(ctx, "releases", "Naima v0.9")
    assert.equal(rel.meta.status, "staging")

    await assert.rejects(p.run("set", `releases/${rel.slug}`, "status=released"), new RegExp(`cannot be released: record Stage: ${STAGES[0]}`))

    for (const stage of STAGES.slice(0, -1)) {
      assert.equal(await p.run("note", `releases/${rel.slug}`, "--by", "release agent", `Stage: ${stage}\nChecked, all green.`), 0)
    }
    await assert.rejects(p.run("set", `releases/${rel.slug}`, "status=released"), new RegExp(`record Stage: ${STAGES.at(-1)}`))
    p.output.length = 0
    assert.equal(await p.run("view", "releases"), 0)
    assert.match(p.output.join("\n"), new RegExp(`✗ releases/naima-v0-9.*\\[staging\\].*owes: ${STAGES.at(-1)}`))

    assert.equal(await p.run("note", `releases/${rel.slug}`, "--by", "release agent", "Stage: announce — skipped, decided by the owner"), 0)
    assert.match(await messages(ctx, "notes"), /releases\/naima-v0-9.* every stage is recorded — naima set .* status=released/)
    assert.equal(await p.run("set", `releases/${rel.slug}`, "status=released"), 0)
    assert.equal(fresh(ctx, rel).meta.status, "released")
    assert.doesNotMatch(await messages(ctx, "problems"), /releases\//)

    p.output.length = 0
    assert.equal(await p.run("view", "releases"), 0)
    assert.match(p.output.join("\n"), /✓ releases\/naima-v0-9 .*\[released\]/)
  } finally {
    p.cleanup()
  }
})
