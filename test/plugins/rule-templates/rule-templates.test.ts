// rule-templates: ready-made rules, shipped as data; none exists in a project until asked for.

import assert from "node:assert/strict"
import { test } from "node:test"
import { tempProject } from "../../core/testing.ts"
import ruleTemplates, { TEMPLATES } from "../../../naima/src/plugins/rule-templates/index.ts"
import rules from "../../../naima/src/plugins/rules/index.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"

const project = () => tempProject([trackers(), rules(), ruleTemplates()])

test("ships four to six templates, none present as a project rule until added", async () => {
  const p = project()
  try {
    assert.ok(TEMPLATES.length >= 4 && TEMPLATES.length <= 6, `expected 4-6 templates, got ${TEMPLATES.length}`)
    assert.equal(p.ctx.repo.items.filter((i) => i.type === "rules").length, 0)

    await p.run("rule-templates")
    for (const t of TEMPLATES) assert.match(p.output.join("\n"), new RegExp(t.id))
  } finally {
    p.cleanup()
  }
})

test("rule-templates add writes an ordinary rules item, audience agents, for the project to enable or edit", async () => {
  const p = project()
  try {
    const { ctx } = p
    assert.equal(await p.run("rule-templates", "add", "one-predicate"), 0)
    const made = ctx.repo.items.find((i) => i.type === "rules")
    assert.ok(made, "a rules item was written")
    assert.equal(made!.meta["audience"], "agents")
    assert.equal(made!.meta.status, "active")
    assert.match(p.output.join("\n"), /added from template "one-predicate"/)
  } finally {
    p.cleanup()
  }
})

test("an unknown template id is refused", async () => {
  const p = project()
  try {
    await assert.rejects(() => p.run("rule-templates", "add", "no-such-template"), /no template "no-such-template"/)
  } finally {
    p.cleanup()
  }
})
