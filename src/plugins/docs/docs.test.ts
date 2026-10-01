import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import type { Plugin } from "../../core/api.ts"
import { runChecks } from "../../core/api.ts"
import { tempProject } from "../../core/testing.ts"
import docs, { anchor, anchorsOf, documentationGaps, renderReference } from "./index.ts"

const features: Plugin = {
  name: "features",
  says: "a feature type for the test",
  types: [
    {
      id: "features",
      dir: "FEATURES",
      title: "Features",
      says: "what the software does",
      statuses: { requested: { category: "open", says: "asked for" }, shipped: { category: "done", says: "in a release" } },
      initialStatus: "requested",
    },
  ],
}

const undocumented: Plugin = {
  name: "sloppy",
  says: "",
  commands: [{ name: "go", says: "go somewhere", usage: "go [--fast]", run: () => 0 }],
  // A point of its own, documented as any point is: by what its contributions lack.
  points: [{
    id: "widgets",
    noun: "widget",
    says: "",
    key: (w: { name: string }) => w.name,
    gaps: (w: { decides?: string }) => (w.decides ? [] : ["does not say how it decides"]),
  }],
  contributes: { widgets: [{ name: "g" }] },
}

test("a contribution without its documentation fails check, named", async () => {
  const p = tempProject([docs({}), features, undocumented])
  try {
    const gaps = documentationGaps(p.ctx)
    assert.ok(gaps.includes('plugin "sloppy" does not say what it is'))
    assert.ok(gaps.includes('command "go" (sloppy) has no example'))
    assert.ok(gaps.includes('command "go" (sloppy): option --fast is in the usage but not documented'))
    assert.ok(gaps.includes('widget "g" does not say how it decides'))
    assert.ok(gaps.includes('extension point "widgets" does not say what it is'))
    assert.ok((await runChecks(p.ctx)).problems.some((f) => f.message.startsWith("undocumented:")))
  } finally {
    p.cleanup()
  }
})

test("the core and the docs plugin document themselves", () => {
  const p = tempProject([docs({}), features])
  try {
    assert.deepEqual(documentationGaps(p.ctx), [])
  } finally {
    p.cleanup()
  }
})

test("the reference is generated, written, and checked for drift", async () => {
  const p = tempProject([docs({ reference: "REFERENCE.md" }), features])
  try {
    const text = renderReference(p.ctx)
    assert.match(text, /### naima docs/)
    assert.match(text, /### naima init/)
    assert.match(text, /### type: features/)
    assert.ok((await runChecks(p.ctx)).problems.some((f) => /REFERENCE.md does not exist/.test(f.message)))
    assert.equal(await p.run("docs", "--write"), 0)
    assert.equal(readFileSync(join(p.root, "REFERENCE.md"), "utf8"), text)
    assert.equal((await runChecks(p.ctx)).problems.length, 0)
    writeFileSync(join(p.root, "REFERENCE.md"), text + "hand edit\n")
    assert.ok((await runChecks(p.ctx)).problems.some((f) => /out of date/.test(f.message)))
    assert.equal(await p.run("docs", "--check"), 1)
  } finally {
    p.cleanup()
  }
})

test("the reference lists every extension point, who declares it and who contributes to it, and documents each contribution as its point says", () => {
  const widgets: Plugin = {
    name: "widgets",
    says: "declares a point",
    points: [{
      id: "widgets",
      noun: "widget",
      says: "a widget",
      key: (w: { name: string }) => w.name,
      document: (ws: { name: string }[]) => ws.map((w) => `- widget ${w.name}`),
    }],
  }
  const maker: Plugin = { name: "maker", says: "contributes to it", contributes: { widgets: [{ name: "gear" }] } }
  const p = tempProject([docs({}), features, widgets, maker])
  try {
    const text = renderReference(p.ctx)
    assert.match(text, /^## Extension points$/m)
    assert.match(text, /^\| `types` \| core \| item types: .* \| features \|$/m)
    assert.match(text, /^\| `widgets` \| widgets \| a widget \| maker \|$/m)
    assert.match(text, /## maker\n[\s\S]*^- widget gear$/m)
    assert.match(text, /\*\*Extension points\*\* it declares: `widgets`\./)
  } finally {
    p.cleanup()
  }
})

test("every internal link of the generated reference resolves", () => {
  const p = tempProject([docs({}), features])
  try {
    const text = renderReference(p.ctx)
    const anchors = anchorsOf(text)
    for (const m of text.matchAll(/\]\(#([^)]+)\)/g)) assert.ok(anchors.has(m[1] ?? ""), `#${m[1]} has no heading`)
  } finally {
    p.cleanup()
  }
})

test("a shipped feature names documentation that exists", async () => {
  const p = tempProject([docs({}), features])
  try {
    await p.run("new", "features", "Export keeps alpha")
    await p.run("set", "export-keeps-alpha", "status=shipped")
    p.ctx.reload()
    assert.ok((await runChecks(p.ctx)).problems.some((f) => /shipped with no documentation/.test(f.message)))
    writeFileSync(join(p.root, "GUIDE.md"), "# Guide\n\n## Export keeps alpha\n")
    await p.run("set", "export-keeps-alpha", "docs=GUIDE.md#missing")
    p.ctx.reload()
    assert.ok((await runChecks(p.ctx)).problems.some((f) => /GUIDE.md has no heading #missing/.test(f.message)))
    await p.run("set", "export-keeps-alpha", "docs=GUIDE.md#export-keeps-alpha")
    p.ctx.reload()
    assert.equal((await runChecks(p.ctx)).problems.length, 0)
  } finally {
    p.cleanup()
  }
})

test("relative links in the configured markdown resolve", async () => {
  const p = tempProject([docs({ links: ["docs"] }), features])
  try {
    mkdirSync(join(p.root, "docs"))
    writeFileSync(
      join(p.root, "docs", "a.md"),
      "# A\n\n## Two words\n\n[ok](b.md) [ok](#two-words) [web](https://x.invalid) `[code](nope.md)`\n\n```\n[fenced](nope.md)\n```\n",
    )
    writeFileSync(join(p.root, "docs", "b.md"), "# B\n\n[bad](missing.md) [bad anchor](a.md#nope)\n")
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message)
    assert.equal(problems.length, 2, problems.join("\n"))
    assert.ok(problems.some((m) => m.includes("missing.md")))
    assert.ok(problems.some((m) => m.includes("has no heading #nope")))
  } finally {
    p.cleanup()
  }
})

test("anchors follow GitHub's rule, duplicates numbered", () => {
  assert.equal(anchor("naima new"), "naima-new")
  assert.equal(anchor("type: bugs"), "type-bugs")
  assert.equal(anchor("Fixed, resolved, closed"), "fixed-resolved-closed")
  assert.deepEqual([...anchorsOf("# A\n## A\n```\n# not\n```\n")], ["a", "a-1"])
})

test("with nothing configured, every markdown file of the project is link-checked, and nothing git ignores", async () => {
  const p = tempProject([docs(), features], { git: true })
  try {
    writeFileSync(join(p.root, ".gitignore"), "scratch/\n")
    mkdirSync(join(p.root, "scratch"))
    writeFileSync(join(p.root, "scratch", "notes.md"), "[ignored](nowhere.md)\n")
    writeFileSync(join(p.root, "README.md"), "# Read me\n\n[bad](missing.md)\n")
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message)
    assert.deepEqual(problems, ["README.md:3: link missing.md — missing.md does not exist"], "every tracked markdown file, none that git ignores")
  } finally {
    p.cleanup()
  }
})

test("a feature's docs name a markdown file: a bare #heading, an empty entry or a directory is no documentation", async () => {
  const p = tempProject([docs({}), features])
  try {
    await p.run("new", "features", "Export keeps alpha", "--set", "status=shipped")
    mkdirSync(join(p.root, "guide"))
    writeFileSync(join(p.root, "notes.txt"), "export keeps alpha\n")
    for (
      const [value, why] of [["#x", /docs #x — names no file/], ["guide", /docs guide — is a directory, not a markdown file/], [
        "guide#x",
        /docs guide#x — is a directory/,
      ], ["notes.txt", /docs notes\.txt — is not a markdown file/]] as const
    ) {
      await p.run("set", "export-keeps-alpha", `docs=${value}`)
      assert.match((await runChecks(p.ctx)).problems.map((f) => f.message).join("\n"), why, value)
    }
    await p.run("set", "export-keeps-alpha", "docs=,")
    assert.match((await runChecks(p.ctx)).problems.map((f) => f.message).join("\n"), /shipped with no documentation/)
  } finally {
    p.cleanup()
  }
})

test("a setext heading, underlined with === or ---, is an anchor links resolve to", async () => {
  assert.deepEqual([...anchorsOf("Title\n=====\n\nSome section\n---\n\ntext\n\n---\n\n- item\n---\n")], ["title", "some-section"])
  const p = tempProject([docs({ links: ["docs"] }), features])
  try {
    mkdirSync(join(p.root, "docs"))
    writeFileSync(join(p.root, "docs", "a.md"), "Guide\n=====\n\nExport keeps alpha\n------------------\n")
    writeFileSync(join(p.root, "docs", "b.md"), "# B\n\n[one](a.md#guide) [two](a.md#export-keeps-alpha)\n")
    assert.deepEqual((await runChecks(p.ctx)).problems.map((f) => f.message), [])
  } finally {
    p.cleanup()
  }
})

test("properties: an anchor is lowercase, has no whitespace or punctuation but - and _, and a heading's anchor is found in its file", () => {
  let s = 3
  const next = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const alphabet = [..."aZ9 -_.,:`()[]!?#é", "Ж", "导"]
  for (let i = 0; i < 1000; i++) {
    const heading = "x" + Array.from({ length: Math.floor(next() * 20) }, () => alphabet[Math.floor(next() * alphabet.length)]).join("")
    const a = anchor(heading)
    assert.match(a, /^[\p{Ll}\p{Lo}\p{N}_-]*$/u, heading)
    assert.equal(anchor(a), a)
    assert.ok(anchorsOf(`# ${heading.replace(/#+\s*$/, "")}\n`).size === 1, heading)
  }
})
