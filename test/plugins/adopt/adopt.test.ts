import assert from "node:assert/strict"
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { type Item, readReadme, runChecks } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import trackers from "../../../naima/src/plugins/trackers/index.ts"
import adopt, { ADOPTED, proposeMarkers, splitMarked, stripMarkers } from "../../../naima/src/plugins/adopt/index.ts"

const FIXTURES = join(dirname(new URL(import.meta.url).pathname), "fixtures")
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8")

const project = () => tempProject([trackers(), adopt()], { git: true })
const adopted = (items: readonly Item[]): Item[] => items.filter((i) => typeof i.meta["adoptedFrom"] === "string")
/** An item's page without its title line and the blank line after it: what adoption carried over. */
const body = (item: Item): string => readReadme(item).replace(/^# [^\n]*\n\n/, "")

test("propose inserts markers only: removing them gives the source back byte for byte, and the dry run writes nothing", async () => {
  const p = project()
  try {
    const original = fixture("TODO.md")
    writeFileSync(join(p.root, "TODO.md"), original)
    p.git("add", "TODO.md")
    p.git("commit", "-q", "-m", "board")

    assert.equal(await p.run("adopt", "propose", "TODO.md"), 0)
    const out = p.output.join("\n")
    assert.match(out, /5 markers proposed, 0 lines deleted/)
    assert.match(out, /dry run: nothing written/)
    assert.equal(readFileSync(join(p.root, "TODO.md"), "utf8"), original, "the dry run leaves the source alone")

    p.output.length = 0
    assert.equal(await p.run("adopt", "propose", "TODO.md", "--write"), 0)
    const marked = readFileSync(join(p.root, "TODO.md"), "utf8")
    assert.notEqual(marked, original)
    assert.equal(stripMarkers(marked), original, "the markers are the only change")
    const [added, deleted] = p.git("diff", "--numstat", "--", "TODO.md").split("\t")
    assert.equal(deleted, "0", "the diff deletes zero lines")
    assert.equal(Number(added), 10, "five opening markers and five closing ones")
    assert.match(marked, /<!-- naima: todos key=fix-login-redirect-loop -->\n- \[ \] Fix the login redirect loop\n {2}After/)
    assert.match(marked, /<!-- naima: todos key=write-install-guide status=done -->\n- \[x\] Write the install guide\n<!-- \/naima -->/)
    assert.match(marked, /<!-- naima: bugs key=bug-export-crashes-empty-files -->/)
    assert.match(marked, /1\. Support dark mode\n {3}- follow the system setting\n\n {3}- and a toggle in settings\n<!-- \/naima -->/)

    p.output.length = 0
    assert.equal(await p.run("adopt", "propose", "TODO.md"), 0)
    assert.match(p.output.join("\n"), /0 markers proposed/, "a marked board needs no new marker")
  } finally {
    p.cleanup()
  }
})

test("a list item at the end of a file with no final newline needs no closing marker", () => {
  const original = fixture("no-final-newline.md")
  const { text, markers } = proposeMarkers(original)
  assert.equal(markers.length, 2)
  assert.equal(stripMarkers(text), original)
  assert.ok(text.endsWith("- Ship a binary"))
  const { segments } = splitMarked(text)
  assert.deepEqual(segments.map((s) => s.text), ["- Keep a changelog\n", "- Ship a binary"])
})

test("split: a dry run first, then one item per marker with its prose byte for byte, its section, its status and where it came from", async () => {
  const p = project()
  try {
    const original = fixture("TODO.md")
    writeFileSync(join(p.root, "TODO.md"), original)
    await p.run("adopt", "propose", "TODO.md", "--write")
    p.git("add", "TODO.md")
    p.git("commit", "-q", "-m", "markers")
    const head = p.git("rev-parse", "HEAD")

    p.output.length = 0
    assert.equal(await p.run("adopt", "split", "TODO.md"), 0)
    assert.match(p.output.join("\n"), /would open 5 items/)
    assert.equal(adopted(p.ctx.repo.items).length, 0, "the dry run opens nothing")
    assert.ok(!existsSync(join(p.ctx.trackerRoot, ADOPTED)))

    p.output.length = 0
    assert.equal(await p.run("adopt", "split", "TODO.md", "--write"), 0)
    p.ctx.reload()
    const items = adopted(p.ctx.repo.items)
    assert.equal(items.length, 5)
    const byTitle = new Map(items.map((i) => [String(i.meta.title), i]))
    const login = byTitle.get("Fix the login redirect loop")!
    assert.equal(login.type, "todos")
    assert.equal(login.meta["section"], "Now")
    assert.equal(body(login), "- [ ] Fix the login redirect loop\n  After the session expires the page reloads forever.\n")
    assert.equal(login.meta["adoptedFrom"], `TODO.md#L8-L9@${head.slice(0, 12)}`)
    assert.equal(byTitle.get("Write the install guide")!.meta.status, "done")
    assert.equal(byTitle.get("Bug: export crashes on empty files")!.type, "bugs")
    assert.equal(byTitle.get("Support dark mode")!.meta["section"], "Later")

    // The board's own prose and the items' prose give the source back, byte for byte.
    const record = JSON.parse(readFileSync(join(p.ctx.trackerRoot, ADOPTED, "todo-md.json"), "utf8")) as {
      source: string
      pieces: ({ prose: string } | { item: string })[]
    }
    assert.equal(record.source, "TODO.md")
    const ids = new Map(items.map((i) => [i.meta.id, i]))
    const rebuilt = record.pieces.map((piece) => ("prose" in piece ? piece.prose : body(ids.get(piece.item)!))).join("")
    assert.equal(rebuilt, original)

    assert.equal(readFileSync(join(p.root, "TODO.md"), "utf8").length > original.length, true, "the source is never deleted or emptied")
    const problems = (await runChecks(p.ctx)).problems
    assert.deepEqual(problems.map((f) => f.message), [])
  } finally {
    p.cleanup()
  }
})

test("a re-run adds only what is missing and never overwrites an item", async () => {
  const p = project()
  try {
    writeFileSync(join(p.root, "TODO.md"), fixture("TODO.md"))
    await p.run("adopt", "propose", "TODO.md", "--write")
    await p.run("adopt", "split", "TODO.md", "--write")
    p.ctx.reload()
    const login = adopted(p.ctx.repo.items).find((i) => i.meta.title === "Fix the login redirect loop")!
    writeFileSync(join(login.dir, "README.md"), "# Fix the login redirect loop\n\nRewritten by a person.\n")

    // The source changes: the login item is reworded there, and a new item arrives.
    const marked = readFileSync(join(p.root, "TODO.md"), "utf8")
    writeFileSync(
      join(p.root, "TODO.md"),
      marked.replace("reloads forever", "reloads for ever").replace(
        "2. Translate the docs\n<!-- /naima -->\n",
        "2. Translate the docs\n<!-- /naima -->\n3. Record a demo\n",
      ),
    )

    p.output.length = 0
    assert.equal(await p.run("adopt", "propose", "TODO.md", "--write"), 0)
    assert.match(p.output.join("\n"), /1 marker proposed/)
    p.output.length = 0
    assert.equal(await p.run("adopt", "split", "TODO.md", "--write"), 0)
    const out = p.output.join("\n")
    assert.match(out, /opened 1 item/)
    assert.match(out, /fix-login-redirect-loop: changed in the source since it was adopted; the item is not overwritten/)
    p.ctx.reload()
    const items = adopted(p.ctx.repo.items)
    assert.equal(items.length, 6)
    assert.equal(readReadme(items.find((i) => i.meta.title === "Fix the login redirect loop")!), "# Fix the login redirect loop\n\nRewritten by a person.\n")
    assert.ok(items.some((i) => i.meta.title === "Record a demo"))

    p.output.length = 0
    assert.equal(await p.run("adopt", "split", "TODO.md", "--write"), 0)
    assert.match(p.output.join("\n"), /opened 0 items/)
  } finally {
    p.cleanup()
  }
})

test("audit re-reads every committed version of the source and reports each line not carried over", async () => {
  const p = project()
  try {
    const path = join(p.root, "TODO.md")
    writeFileSync(path, "# Board\n\n- Remove the old API\n- Keep the CLI stable\n")
    p.git("add", "TODO.md")
    p.git("commit", "-q", "-m", "v1")
    const v1 = p.git("rev-parse", "--short=12", "HEAD")
    writeFileSync(path, "# Board\n\n- Keep the CLI stable\n- Write the docs\n")
    p.git("commit", "-q", "-am", "v2: the old API line dropped without being done")
    await p.run("adopt", "propose", "TODO.md", "--write")
    await p.run("adopt", "split", "TODO.md", "--write")

    p.output.length = 0
    assert.equal(await p.run("adopt", "audit", "TODO.md"), 1)
    const out = p.output.join("\n")
    assert.match(out, /2 versions read/)
    assert.match(out, new RegExp(`${v1} L3: - Remove the old API`))
    assert.doesNotMatch(out, /Keep the CLI stable|Write the docs/)
    assert.match(out, /round trip: the board's prose and the items' prose give the source back byte for byte/)

    // Carried over by hand into an item, the line is no longer reported.
    await p.run("new", "todos", "Remove the old API")
    p.ctx.reload()
    const item = p.ctx.repo.items.find((i) => i.meta.title === "Remove the old API")!
    writeFileSync(join(item.dir, "README.md"), "# Remove the old API\n\n- Remove the old API\n")
    p.output.length = 0
    assert.equal(await p.run("adopt", "audit", "TODO.md"), 0)
    assert.match(p.output.join("\n"), /nothing missing/)

    // A list item added to the source and not yet adopted is reported too.
    writeFileSync(path, readFileSync(path, "utf8") + "- Ship it\n")
    p.output.length = 0
    assert.equal(await p.run("adopt", "audit", "TODO.md"), 1)
    assert.match(p.output.join("\n"), /working tree L\d+: - Ship it/)
  } finally {
    p.cleanup()
  }
})

test("links are proposed only on a shared real commit and shared wording; everything else is printed for a person to decide", async () => {
  const p = project()
  try {
    writeFileSync(join(p.root, "x.txt"), "x\n")
    p.git("add", "x.txt")
    p.git("commit", "-q", "-m", "the parser fix")
    const sha = p.git("rev-parse", "HEAD")
    const board = [
      "# Board",
      "",
      `- Parser drops trailing comments, fixed in ${sha.slice(0, 7)}`,
      `- Parser trailing comments regression test, see ${sha.slice(0, 10)}`,
      `- Unrelated release chore also touched in ${sha.slice(0, 8)}`,
      "- Parser comments handling slow on big files",
      "- Run the suite before tagging",
      "  ```sh",
      "  deno task verify",
      "  ```",
      "- Cites deadbeef1234, which is no commit here",
      "",
    ].join("\n")
    writeFileSync(join(p.root, "TODO.md"), board)
    await p.run("adopt", "propose", "TODO.md", "--write")
    await p.run("adopt", "split", "TODO.md", "--write")

    p.output.length = 0
    assert.equal(await p.run("adopt", "links", "TODO.md"), 0)
    const out = p.output.join("\n")
    const proposed = out.slice(out.indexOf("Proposed"), out.indexOf("For a person to decide"))
    assert.match(proposed, /naima link todos\/parser-drops-trailing-comments-fixed[\w-]* relates-to todos\/parser-trailing-comments-regression-test[\w-]*/)
    assert.match(proposed, new RegExp(`commit ${sha.slice(0, 12)}`))
    assert.doesNotMatch(proposed, /unrelated-release-chore|slow-big-files|deadbeef/)
    const decide = out.slice(out.indexOf("For a person to decide"))
    assert.match(decide, /unrelated-release-chore[\w-]*.*shared commit, no shared wording/)
    assert.match(decide, /slow-big-files[\w-]*.*shared wording, no shared commit/)
    assert.match(decide, /gate\? `deno task verify` \(todos\/run-suite-before-tagging[\w-]*\)/)
    assert.doesNotMatch(out, /deadbeef1234.*relates-to/)
    assert.equal(p.ctx.repo.items.flatMap((i) => i.meta.links ?? []).length, 0, "links is a dry run without --write")

    p.output.length = 0
    assert.equal(await p.run("adopt", "links", "TODO.md", "--write"), 0)
    p.ctx.reload()
    assert.equal(p.ctx.repo.items.flatMap((i) => i.meta.links ?? []).length, 1, "only the proposed link is written")
  } finally {
    p.cleanup()
  }
})

test("adopt refuses a split before markers, a path outside the project, and never removes the source", async () => {
  const p = project()
  try {
    copyFileSync(join(FIXTURES, "TODO.md"), join(p.root, "TODO.md"))
    await assert.rejects(p.run("adopt", "split", "TODO.md", "--write"), /no markers in TODO\.md — run naima adopt propose TODO\.md first/)
    await assert.rejects(p.run("adopt", "propose", "../elsewhere.md"), /outside the project/)
    await assert.rejects(p.run("adopt", "propose", "missing.md"), /no file missing\.md/)
    await assert.rejects(p.run("adopt", "frobnicate"), /usage: naima adopt/)
    for (const sub of ["propose", "split", "audit", "links"]) await p.run("adopt", sub, "TODO.md", "--write").catch(() => 0)
    assert.ok(existsSync(join(p.root, "TODO.md")))
    assert.ok(readdirSync(p.root).includes("TODO.md"))
  } finally {
    p.cleanup()
  }
})
