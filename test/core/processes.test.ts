// The guard against a test's child outliving it (bugs/test-runs-leave-naima-ui-processes-running):
// a wait on a child that never answers fails in bounded time, and `stop()` leaves nothing of its group.

import assert from "node:assert/strict"
import { test } from "node:test"
import { groupAlive, leftovers, startGroup } from "./processes.ts"

const skip = process.platform === "win32" && "a process group is POSIX"

test("a wait on a child that never prints fails in bounded time, and stop() leaves nothing of its group behind", { skip, timeout: 30_000 }, async () => {
  const marker = `naima-guard-${process.pid}-${Date.now()}`
  // a parent that keeps a child of its own, as the launcher keeps the program
  const g = startGroup("sh", ["-c", `sleep 600 & sleep 601; : ${marker}`])
  try {
    const started = Date.now()
    await assert.rejects(g.waitFor(/never printed/, 300), /nothing after 300 ms/)
    assert.ok(Date.now() - started < 5000)
    assert.ok(groupAlive(g.pid))
  } finally {
    await g.stop()
  }
  assert.equal(groupAlive(g.pid), false)
  assert.deepEqual(leftovers(marker), [])
})
