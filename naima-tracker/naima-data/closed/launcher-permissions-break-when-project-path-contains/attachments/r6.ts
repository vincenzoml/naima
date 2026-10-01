import { permissions } from "/Users/vincenzo/data/local/repos/naima/src/launcher.ts"
const root = Deno.realPathSync(Deno.args[0])
const flags = permissions({ root, tracker: root + "/naima-tracker", data: null, program: root + "/naima-tracker/naima", entry: root })
console.log(flags[0])
const c = new Deno.Command(Deno.execPath(), { args: ["eval", ...[], "--no-prompt"], })
const r = new Deno.Command(Deno.execPath(), { args: ["run", "--no-prompt", ...flags, "data:text/javascript,console.log(Deno.readTextFileSync(" + JSON.stringify(root + "/x.txt") + ").trim())"] }).outputSync()
console.log("child exit", r.code, new TextDecoder().decode(r.stdout).trim(), new TextDecoder().decode(r.stderr).split("\n")[0])
