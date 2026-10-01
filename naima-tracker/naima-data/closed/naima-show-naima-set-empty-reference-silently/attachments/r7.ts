import { tempProject } from "/Users/vincenzo/data/local/repos/naima/src/core/testing.ts"
import { firstParty } from "/Users/vincenzo/data/local/repos/naima/src/builtins.ts"
const p = tempProject(firstParty({ gates: {} }))
await p.run("new", "bugs", "Only one")
p.output.length = 0
console.log("show (no ref) ->", await p.run("show"), p.output.slice(0, 2))
p.output.length = 0
console.log("set (no ref) ->", await p.run("set"), p.output)
p.output.length = 0
console.log("set created=2024-13-99 ->", await p.run("set", "only-one", "created=2024-13-99"), (await p.run("check"), p.output.at(-1)))
