import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, moveItem, type Plugin, runChecks, setFields } from "../../core/api.ts"
import { tempProject } from "../../core/testing.ts"
import betaMarkers from "./index.ts"

const proofs: Plugin = {
  name: "proofs",
  says: "",
  types: [
    {
      id: "tests",
      dir: "TESTS",
      title: "",
      says: "",
      statuses: { open: { category: "open", says: "" }, passed: { category: "done", proves: true, says: "" } },
      initialStatus: "open",
    },
  ],
  // What beta-markers uses of whatever plugin archives items: plugins never import each other, so a stand-in declares it.
  fields: [{ name: "closedFrom", kind: "string", says: "" }],
}

// Markers are assembled here so this file never contains one itself.
const marker = (ref: string, what: string) => ["// naima", `beta ${ref} ${what}`].join(":")

test("a marker must name an open item and dies with its proof", async () => {
  const p = tempProject([proofs, betaMarkers({ paths: ["app"] })])
  try {
    const t = createItem(p.ctx, p.ctx.registry.types.get("tests")!, "Export keeps alpha")
    mkdirSync(join(p.root, "app", "node_modules"), { recursive: true })
    writeFileSync(join(p.root, "app", "export.ts"), `const x = 1\n  ${marker(`tests/${t.slug}`, "layered export is unproven")}\n`)
    writeFileSync(join(p.root, "app", "node_modules", "dep.ts"), marker("tests/nothing", "skipped") + "\n")
    assert.deepEqual((await runChecks(p.ctx)).problems, [])
    await p.run("beta")
    assert.match(p.output.join("\n"), /unproven\s+app\/export.ts:2\s+tests\/export-keeps-alpha\s+layered export is unproven/)

    writeFileSync(join(p.root, "app", "other.ts"), marker("tests/ghost", "names nothing") + "\n")
    setFields(p.ctx, t, [["status", "passed"]])
    p.ctx.reload()
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /outlived its proof/)
    assert.match(problems, /names "tests\/ghost", which is no item/)
    assert.equal(await p.run("beta", "--check"), 1)
  } finally {
    p.cleanup()
  }
})

test("with nothing configured, every source file of the project is scanned, and nothing git ignores", async () => {
  const p = tempProject([proofs, betaMarkers()], { git: true })
  try {
    writeFileSync(join(p.root, ".gitignore"), "generated/\n")
    mkdirSync(join(p.root, "lib", "deep"), { recursive: true })
    mkdirSync(join(p.root, "generated"))
    mkdirSync(join(p.root, "node_modules"))
    writeFileSync(join(p.root, "lib", "deep", "a.py"), marker("tests/ghost", "anywhere in the project") + "\n")
    writeFileSync(join(p.root, "generated", "b.ts"), marker("tests/ghost", "ignored by git") + "\n")
    writeFileSync(join(p.root, "node_modules", "c.ts"), marker("tests/ghost", "a dependency") + "\n")
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message)
    assert.deepEqual(problems, ['lib/deep/a.py:1: beta marker names "tests/ghost", which is no item'])
  } finally {
    p.cleanup()
  }
})

test("a marker naming an item since archived is found through the archive, and a bad reference says why", async () => {
  const archive: Plugin = {
    name: "archive",
    says: "",
    types: [
      { id: "bugs", dir: "BUGS", title: "", says: "", statuses: { open: { category: "open", says: "" } }, initialStatus: "open" },
      { id: "closed", dir: "CLOSED", title: "", says: "", statuses: { closed: { category: "done", says: "" } }, initialStatus: "closed", creatable: false },
    ],
    fields: [{ name: "closedFrom", kind: "string", says: "" }],
  }
  const p = tempProject([archive, betaMarkers({ paths: ["app"] })])
  try {
    const bug = createItem(p.ctx, p.ctx.registry.types.get("bugs")!, "Export drops alpha")
    createItem(p.ctx, p.ctx.registry.types.get("bugs")!, "Export drops beta")
    mkdirSync(join(p.root, "app"))
    writeFileSync(join(p.root, "app", "a.ts"), marker("bugs/export-drops-alpha", "unproven") + "\n" + marker("export-drops", "which one") + "\n")
    setFields(p.ctx, bug, [["closedFrom", "bugs"]])
    const moved = moveItem(p.ctx, p.ctx.repo.resolve(bug.meta.id), p.ctx.registry.types.get("closed")!)
    setFields(p.ctx, p.ctx.repo.resolve(moved.meta.id), [["status", "closed"]])
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /a\.ts:1: beta marker outlived its proof — closed\/export-drops-alpha is closed/)
    assert.match(problems, /a\.ts:2: beta marker names "export-drops", which does not resolve: "export-drops" is ambiguous/)
  } finally {
    p.cleanup()
  }
})
