import { runCli } from "/Users/vincenzo/data/local/repos/naima/src/core/index.ts"
import { align } from "/Users/vincenzo/data/local/repos/naima/src/core/program.ts"
import { firstParty } from "/Users/vincenzo/data/local/repos/naima/src/builtins.ts"
import { readFileSync } from "node:fs"
const [proj, prog, other] = Deno.args
console.log("init ->", await runCli(["init"], { cwd: proj, programRoot: prog, firstParty }))
const lock = JSON.parse(readFileSync(`${proj}/naima-tracker/naima-data/naima.json`, "utf8"))
console.log("lock:", JSON.stringify(lock))
try { align({ root: other, tracker: `${other}/naima-tracker`, program: `${other}/naima-tracker/naima`, source: lock.source, commit: lock.commit, carry: "clone" }); console.log("align ok") } catch (e) { console.log("align on another clone:", (e as Error).message) }
