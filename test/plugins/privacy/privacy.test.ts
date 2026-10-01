import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createItem, type Plugin, runChecks } from "../../../naima/src/core/api.ts"
import { tempProject } from "../../core/testing.ts"
import privacy, { findSecrets } from "../../../naima/src/plugins/privacy/index.ts"

const tasks: Plugin = {
  name: "tasks",
  says: "a minimal item type for the tests",
  types: [{ id: "tasks", dir: "tasks", title: "Tasks", says: "a task", statuses: { open: { category: "open", says: "open" } }, initialStatus: "open" }],
}

// Every secret here is built at run time, so this file holds none of the shapes it tests.
const B64 = "MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun"
const SHAPES: Record<string, string> = {
  "private key": ["-----BEGIN RSA ", "PRIVATE KEY-----\n", B64, "\n", B64, "\n-----END RSA ", "PRIVATE KEY-----\n"].join(""),
  "AWS access key": "aws_key = " + "AKIA" + "IOSFODNN7EXAMPLQ",
  "GitHub token": "token: " + "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8",
  "Slack token": "SLACK=" + "xoxb-" + "123456789012-1234567890123-AbCdEfGhIjKlMnOp",
  "API secret key": "key = " + "sk-" + "ant-" + "api03-" + "x".repeat(40),
  "Google API key": "google: " + "AIza" + "SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q",
}

test("findSecrets catches each of six secret shapes, and a private-key header with no body after it is not one", () => {
  for (const [shape, text] of Object.entries(SHAPES)) {
    const found = findSecrets(`before\n${text}\nafter\n`)
    assert.equal(found.length, 1, `${shape} caught once`)
    assert.equal(found[0]?.shape, shape)
  }
  assert.deepEqual(findSecrets("Keys start with -----BEGIN OPENSSH " + "PRIVATE KEY----- and then a body.\n"), [])
  assert.deepEqual(findSecrets(["-----BEGIN EC ", "PRIVATE KEY-----\n", "-----END EC ", "PRIVATE KEY-----\n"].join("")), [])
  assert.deepEqual(findSecrets("the prefix AKIA alone, or ghp_ alone, is not a key"), [])
})

test("the secrets check reports a secret in a project file and in an attachment; an exception needs a reason and an item, and one matching nothing is a note", async () => {
  const p = tempProject([tasks, privacy()])
  try {
    writeFileSync(join(p.root, "deploy.env"), SHAPES["AWS access key"] + "\n")
    const item = createItem(p.ctx, p.ctx.registry.types.get("tasks")!, "Logs")
    writeFileSync(join(item.dir, "attachments", "session.log"), SHAPES["GitHub token"] + "\n")
    p.ctx.reload()
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /deploy\.env:1: an AWS access key/)
    assert.match(problems, /tasks\/logs\/attachments\/session\.log:1: a GitHub token/)

    const ok = tempProject([tasks, privacy({ exceptions: [{ path: "deploy.env", reason: "a revoked example key", item: "tasks/logs" }] })])
    try {
      writeFileSync(join(ok.root, "deploy.env"), SHAPES["AWS access key"] + "\n")
      createItem(ok.ctx, ok.ctx.registry.types.get("tasks")!, "Logs")
      assert.doesNotMatch((await runChecks(ok.ctx)).problems.map((f) => f.message).join("\n"), /deploy\.env/)
    } finally {
      ok.cleanup()
    }

    const bad = tempProject([tasks, privacy({ exceptions: [{ path: "clean.txt", reason: "" }] })])
    try {
      writeFileSync(join(bad.root, "clean.txt"), "nothing here\n")
      const report = await runChecks(bad.ctx)
      assert.match(report.problems.map((f) => f.message).join("\n"), /the exception for clean\.txt needs a reason and an item/)
      assert.match(report.notes.map((f) => f.message).join("\n"), /the exception for clean\.txt matches no secret: remove it/)
    } finally {
      bad.cleanup()
    }
  } finally {
    p.cleanup()
  }
})

test("the exception list only shrinks: an exception the trunk's configuration does not hold is refused", async () => {
  const p = tempProject([tasks, privacy({ exceptions: [{ path: "deploy.env", reason: "a revoked example key", item: "tasks/logs" }] })], { git: true })
  try {
    createItem(p.ctx, p.ctx.registry.types.get("tasks")!, "Logs")
    writeFileSync(join(p.root, "deploy.env"), SHAPES["AWS access key"] + "\n")
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /the exception for deploy\.env is not on the trunk \(main\): the list only shrinks/)
  } finally {
    p.cleanup()
  }
})

test("naima attach copies a file with a consent record; it refuses without --consent or --own, and refuses a file holding a secret", async () => {
  const p = tempProject([tasks, privacy()])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tasks")!, "Export loses alpha")
    const shot = join(p.root, "shot.png")
    writeFileSync(shot, "PNG")
    await assert.rejects(p.run("attach", "export-loses-alpha", shot), /--consent "<the owner's yes, restated>"/)
    assert.equal(await p.run("attach", "export-loses-alpha", shot, "--consent", "Yes, attach my screenshot", "--by", "agent"), 0)
    assert.equal(readFileSync(join(item.dir, "attachments", "shot.png"), "utf8"), "PNG")
    p.ctx.reload()
    const meta = p.ctx.repo.resolve("export-loses-alpha").meta
    assert.deepEqual(meta["attached"], { "shot.png": { from: "owner", consent: "Yes, attach my screenshot", by: "agent", on: "2026-01-15" } })

    const log = join(p.root, "run.out")
    writeFileSync(log, "12 passed\n")
    assert.equal(await p.run("attach", "export-loses-alpha", log, "--own", "--as", "proof.out", "--by", "agent"), 0)
    assert.ok(existsSync(join(item.dir, "attachments", "proof.out")))
    await assert.rejects(p.run("attach", "export-loses-alpha", log, "--own", "--as", "proof.out", "--by", "agent"), /already holds proof\.out/)
    await assert.rejects(p.run("attach", "export-loses-alpha", log, "--own", "--consent", "yes", "--by", "agent"), /one of --consent and --own/)

    const outside = mkdtempSync(join(tmpdir(), "naima-outside-"))
    const leaky = join(outside, "leaky.log")
    writeFileSync(leaky, SHAPES["Slack token"] + "\n")
    await assert.rejects(p.run("attach", "export-loses-alpha", leaky, "--own", "--by", "agent"), /leaky\.log:1 holds a Slack token: redact it/)
    assert.ok(!existsSync(join(item.dir, "attachments", "leaky.log")))
    rmSync(outside, { recursive: true, force: true })
    assert.deepEqual((await runChecks(p.ctx)).problems, [])
  } finally {
    p.cleanup()
  }
})

test("the attachment-consent check: an attachment with no record is flagged, so is a record with no file or an owner's file with no yes", async () => {
  const p = tempProject([tasks, privacy()])
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tasks")!, "Hand copied")
    writeFileSync(join(item.dir, "attachments", "owner-screenshot.png"), "PNG")
    writeFileSync(join(item.dir, "attachments", "run-2026-01-15T10-00-00-000Z.json"), "{}")
    const meta = JSON.parse(readFileSync(join(item.dir, "meta.json"), "utf8"))
    meta.attached = { "gone.txt": { from: "agent", by: "a", on: "2026-01-15" }, "silent.png": { from: "owner", by: "a", on: "2026-01-15" } }
    writeFileSync(join(item.dir, "attachments", "silent.png"), "PNG")
    writeFileSync(join(item.dir, "meta.json"), JSON.stringify(meta))
    p.ctx.reload()
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /tasks\/hand-copied: attachments\/owner-screenshot\.png has no consent record — naima attach/)
    assert.match(problems, /tasks\/hand-copied: attached names gone\.txt, which is not in attachments\//)
    assert.match(problems, /tasks\/hand-copied: attachments\/silent\.png is the owner's, with no consent recorded/)
    assert.doesNotMatch(problems, /run-2026|\.gitkeep/)
  } finally {
    p.cleanup()
  }
})

test("an attachment the trunk already holds is not flagged: the check holds what a branch adds", async () => {
  const p = tempProject([tasks, privacy()], { git: true })
  try {
    const item = createItem(p.ctx, p.ctx.registry.types.get("tasks")!, "Old evidence")
    writeFileSync(join(item.dir, "attachments", "old.txt"), "from before\n")
    p.git("add", "-A")
    p.git("commit", "-q", "-m", "old evidence")
    p.git("checkout", "-q", "-b", "work")
    writeFileSync(join(item.dir, "attachments", "new.txt"), "added here\n")
    p.ctx.reload()
    const problems = (await runChecks(p.ctx)).problems.map((f) => f.message).join("\n")
    assert.match(problems, /attachments\/new\.txt has no consent record/)
    assert.doesNotMatch(problems, /old\.txt/)
  } finally {
    p.cleanup()
  }
})
