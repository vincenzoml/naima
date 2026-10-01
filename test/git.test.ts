// gitPath/nativePath: the pair that turns a path between git's own form (forward slashes, any
// platform) and node:path/node:fs's form (the platform's own separator). Regression for the
// Windows install failure (naima: this Naima is not a clone with an origin) where
// runningCommit() (naima/src/core/cli.ts) compared git's forward-slash --show-toplevel output
// directly against real()'s backslash path and never matched. Run with a simulated Windows
// separator so the case is exercised on every runtime without a Windows filesystem.

import assert from "node:assert/strict"
import { test } from "node:test"
import { gitPath, nativePath } from "../naima/src/core/git.ts"

test("nativePath turns git's forward-slash toplevel into the separator a Windows node:fs path uses", () => {
  const gitTop = "D:/a/naima/naima-tracker-project/naima-tracker/naima" // as `git rev-parse --show-toplevel` prints on Windows
  const realRoot = "D:\\a\\naima\\naima-tracker-project\\naima-tracker\\naima" // as real() (node:fs) names the same directory there
  assert.notEqual(gitTop, realRoot, "the two forms differ — comparing them as-is is the bug this regresses")
  assert.equal(nativePath(gitTop, "\\"), realRoot)
})

test("nativePath is the identity on POSIX, where git's separator already is the platform's", () => {
  const gitTop = "/home/runner/work/naima/naima"
  assert.equal(nativePath(gitTop, "/"), gitTop)
})

test("gitPath and nativePath are inverses, on an arbitrary separator", () => {
  const native = "D:\\a\\naima\\naima"
  assert.equal(nativePath(gitPath(native, "\\"), "\\"), native)
  const posix = "/home/runner/work/naima/naima"
  assert.equal(gitPath(nativePath(posix, "/"), "/"), posix)
})
