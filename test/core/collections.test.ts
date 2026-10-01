import assert from "node:assert/strict"
import { test } from "node:test"
import { groupBy } from "../../naima/src/core/internal.ts"

test("groupBy keeps key and item order, and is linear in the number of items", () => {
  assert.deepEqual([...groupBy([1, 2, 3, 4, 5], (n) => (n % 2 ? "odd" : "even"))], [["odd", [1, 3, 5]], ["even", [2, 4]]])
  // One group of 200,000: a copy per push (the spread it replaced) is ~2·10^10 element copies; a push is 2·10^5.
  const many = Array.from({ length: 200_000 }, (_, i) => i)
  const start = performance.now()
  const groups = groupBy(many, () => "same")
  const ms = performance.now() - start
  assert.equal(groups.get("same")?.length, 200_000)
  assert.ok(ms < 1000, `grouping 200,000 items took ${Math.round(ms)} ms`)
})
