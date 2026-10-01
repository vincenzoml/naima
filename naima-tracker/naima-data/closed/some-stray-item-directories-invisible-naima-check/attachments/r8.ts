import { tempProject } from "/Users/vincenzo/data/local/repos/naima/src/core/testing.ts"
import { firstParty } from "/Users/vincenzo/data/local/repos/naima/src/builtins.ts"
import { mkdirSync, writeFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"
const p = tempProject(firstParty({ gates: {} }))
const bugs = join(p.ctx.trackerRoot, "bugs")
mkdirSync(join(bugs, "_draft"), { recursive: true }); writeFileSync(join(bugs, "_draft", "meta.json"), "{ not json")
mkdirSync(join(p.root, "elsewhere", "real-bug"), { recursive: true }); writeFileSync(join(p.root, "elsewhere", "real-bug", "meta.json"), "{ not json")
symlinkSync(join(p.root, "elsewhere", "real-bug"), join(bugs, "linked-bug"))
mkdirSync(join(p.ctx.trackerRoot, "bgus", "typo-item"), { recursive: true })
console.log("check ->", await p.run("check")); console.log(p.output.join("\n"))
