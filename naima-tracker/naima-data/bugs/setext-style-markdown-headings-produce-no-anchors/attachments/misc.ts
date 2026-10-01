import { newRepo, ctxAt } from "./h.ts"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
const S = "/Users/vincenzo/data/local/repos/naima/src"
const { confidenceFrom } = await import(`${S}/plugins/triage/index.ts`)
for (const t of ["Could not be reproduced on macOS", "Not verified yet", "cannot be confirmed", "not yet reproduced", "It crashes because of X? unknown"]) console.log("R7", JSON.stringify(t), "->", confidenceFrom(t))
const { unresolved, anchorsOf } = await import(`${S}/plugins/docs/index.ts`)
const root = newRepo()
console.log("R13 '#nope':", unresolved(root, root, "#nope"), " 'docs/':", unresolved(root, root, "naima-tracker"))
console.log("R14 setext anchors:", [...anchorsOf("Title\n=====\n\nSub\n---\n")])
// pass --list with non-number
const m = ctxAt(root); await m.run("pass", "hello"); m.out.length = 0; await m.run("pass", "--list", "all"); console.log("R15 pass --list all:", JSON.stringify(m.out))
// triage fallback ranks
const { enumRank } = await import(`${S}/core/fields.ts`)
