// status prototype keys, new --set leftovers, symmetric double links, case-insensitive slug overwrite, unicode duplicates, empty ref
import { tempProject } from "/Users/vincenzo/data/local/repos/naima/src/core/testing.ts"
import { firstParty } from "/Users/vincenzo/data/local/repos/naima/src/builtins.ts"
import { existsSync, readdirSync, readFileSync, renameSync } from "node:fs"
import { join } from "node:path"
const p = tempProject(firstParty({ gates: {} }))
const say = (s: string) => console.log("## " + s)
const run = async (...a: string[]) => { p.output.length = 0; p.errors.length = 0; let c; try { c = await p.run(a[0], ...a.slice(1)) } catch (e) { c = "THROW " + (e as Error).message } console.log(`$ naima ${a.join(" ")} -> ${c}`); for (const l of p.output) console.log("   " + l) }
const bugsDir = join(p.ctx.trackerRoot, "bugs")

say("1 status=constructor")
await run("new", "bugs", "Export drops alpha")
await run("set", "export-drops-alpha", "status=constructor")
console.log("   stored:", JSON.parse(readFileSync(join(bugsDir, "export-drops-alpha", "meta.json"), "utf8")).status)
await run("set", "export-drops-alpha", "status=__proto__")
await run("check")
await run("list")

say("2 new --set with a bad field leaves the item")
const before = readdirSync(bugsDir).length
await run("new", "bugs", "Half made", "--set", "nosuchfield=1")
console.log("   bug dirs before/after:", before, readdirSync(bugsDir).length, readdirSync(bugsDir))

say("3 symmetric links stored twice")
await run("new", "bugs", "Other one")
await run("link", "export-drops-alpha", "relates-to", "other-one")
await run("link", "other-one", "relates-to", "export-drops-alpha")
await run("show", "other-one")

say("4 case-insensitive slug collision")
await run("new", "bugs", "Crash on save")
await run("set", "crash-save", "tags=precious")
renameSync(join(bugsDir, "crash-save"), join(bugsDir, "Crash-save"))
const oldId = JSON.parse(readFileSync(join(bugsDir, "Crash-save", "meta.json"), "utf8")).id
await run("new", "bugs", "crash save")
const after = JSON.parse(readFileSync(join(bugsDir, "Crash-save", "meta.json"), "utf8"))
console.log("   old id", oldId, "now", after.id, "tags", after.tags, "dirs", readdirSync(bugsDir))

say("5 unicode titles as duplicates")
await run("new", "todos", "Исправить экспорт")
await run("new", "todos", "修复导出")
await run("check")

say("6 empty ref")
