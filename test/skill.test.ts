// The agent skill: it exists where agent tools look for it, it loads (front
// matter with the name of its directory and a description), and every link
// it points through resolves.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { brokenLinks } from "../naima/src/plugins/docs/index.ts"

/** The runtime folder, where the skill ships. */
const REPO = join(dirname(dirname(fileURLToPath(import.meta.url))), "naima")

test("skills/naima/SKILL.md loads, and its links resolve", () => {
  const text = readFileSync(join(REPO, "skills", "naima", "SKILL.md"), "utf8")
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)
  assert.ok(front?.[1], "front matter between --- lines")
  const fields = Object.fromEntries(front[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]))
  assert.equal(fields["name"], "naima", "the name is the directory's")
  assert.ok((fields["description"] ?? "").length > 40, "a description that says when to use it")
  assert.match(text, /deno\.land\/install\.sh/, "it installs Deno when it is missing, with the official installer")
  assert.match(
    text,
    /git clone \S+ naima-tracker\/naima\ndeno run -A naima-tracker\/naima\/naima\.ts init\n/,
    "it installs by cloning Naima straight into naima-tracker/naima",
  )
  assert.match(text, /naima(\.ts)? init/, "it starts a project that has no naima-tracker/")
  assert.match(text, /naima update --check/, "it checks for an update at the start of a session")
  assert.ok((text.match(/\]\(\.\.\/\.\.\/docs\//g) ?? []).length >= 3, "it points at the docs rather than copying them")
  assert.deepEqual(brokenLinks(REPO, ["skills"]), [])
})
