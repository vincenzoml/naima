// The lock's source: what git is handed as an argument (docs/reference/format.md#the-lock).

import assert from "node:assert/strict"
import { test } from "node:test"
import { withoutCredentials } from "../../naima/src/core/cli.ts"
import { parseLock } from "../../naima/src/core/config.ts"
import { globalOptions } from "../../naima/src/core/layout.ts"

const lock = (source: string) => parseLock({ source, commit: "0".repeat(40) })

test("a source git would read as an option is refused, and so is a relative path", () => {
  assert.throws(() => lock("--upload-pack=touch /tmp/pwned"), /source must not start with "-": git would read it as an option/)
  assert.throws(() => lock("-u"), /must not start with "-"/)
  assert.throws(() => lock("../naima"), /a path on this disk must be absolute/)
  assert.throws(() => lock("naima"), /must be absolute/)
})

test("URLs, scp-like addresses, file: URLs and absolute paths are sources", () => {
  for (
    const source of [
      "https://github.com/vincenzoml/naima.git",
      "ssh://git@example.com/naima.git",
      "git@github.com:vincenzoml/naima.git",
      "file:///srv/naima.git",
      "/srv/naima",
    ]
  ) {
    assert.equal(lock(source).source, source)
  }
})

test("credentials leave an origin URL before it becomes a lock: all of them over http, the password elsewhere", () => {
  assert.equal(withoutCredentials("https://someone:ghp_token@github.com/x/naima.git"), "https://github.com/x/naima.git")
  assert.equal(withoutCredentials("https://ghp_token@github.com/x/naima.git"), "https://github.com/x/naima.git")
  assert.equal(withoutCredentials("ssh://git:secret@example.com/naima.git"), "ssh://git@example.com/naima.git")
  assert.equal(withoutCredentials("ssh://git@example.com/naima.git"), "ssh://git@example.com/naima.git")
  assert.equal(withoutCredentials("git@github.com:x/naima.git"), "git@github.com:x/naima.git")
  assert.equal(withoutCredentials("/srv/naima"), "/srv/naima")
})

test("--data is read by one parser, the launcher's and the program's: both forms, and an empty value refused", () => {
  assert.deepEqual(globalOptions(["--data", "rel/dir", "check"]), { data: "rel/dir", rest: ["check"] })
  assert.deepEqual(globalOptions(["--data=rel/dir", "check"]), { data: "rel/dir", rest: ["check"] })
  assert.deepEqual(globalOptions(["check", "--data", "x"]), { rest: ["check", "--data", "x"] }, "only first")
  assert.throws(() => globalOptions(["--data"]), /--data needs a directory/)
  assert.throws(() => globalOptions(["--data="]), /--data needs a directory/)
})

test('verify is "signed" or absent', () => {
  const commit = "0".repeat(40)
  assert.equal(parseLock({ source: "/srv/naima", commit }).verify, undefined)
  assert.equal(parseLock({ source: "/srv/naima", commit, verify: "signed" }).verify, "signed")
  assert.throws(() => parseLock({ source: "/srv/naima", commit, verify: "yes" }), /verify is "signed", or absent/)
})
