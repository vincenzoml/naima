// The documentation's shape (develop/documentation.md): every relative
// link in every markdown file of the repository resolves, every page of the
// guide, the agent pages and the developer pages is reachable from its
// section's index, and the rules are linked, never copied, from the skill,
// AGENTS.md and the agent pages.

import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { brokenLinks } from "../naima/src/plugins/docs/index.ts"

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path: string): string => readFileSync(join(REPO, path), "utf8")
const links = (text: string): string[] => [...text.matchAll(/\]\(([^)#\s]+)/g)].map((m) => m[1] as string)

test("every relative link in every markdown file of the repository resolves", () => {
  assert.deepEqual(brokenLinks(REPO), [])
})

for (const section of ["naima/docs/guide", "naima/docs/agents", "develop"]) {
  test(`every page of ${section}/ is linked from its index`, () => {
    const index = links(read(`${section}/README.md`))
    const pages = readdirSync(join(REPO, section)).filter((f) => f.endsWith(".md") && f !== "README.md")
    assert.ok(pages.length > 0)
    for (const page of pages) assert.ok(index.includes(page), `${section}/README.md links ${page}`)
  })
}

test("the rules are linked from the skill, AGENTS.md and the agent pages", () => {
  for (
    const [file, target] of [
      ["naima/skills/naima/SKILL.md", "../../docs/guide/rules.md"],
      ["AGENTS.md", "naima/docs/guide/rules.md"],
      ["naima/docs/agents/README.md", "../guide/rules.md"],
      ["naima/docs/agents/skill.md", "../guide/rules.md"],
    ] as const
  ) {
    assert.ok(links(read(file)).includes(target), `${file} links ${target}`)
  }
})
