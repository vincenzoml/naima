import { readAcrossBranches, refsWorthReading } from "/Users/vincenzo/data/local/repos/naima/src/core/git.ts"
const [root, mode] = Deno.args
console.log(mode, "refs:", JSON.stringify(refsWorthReading(root)), "files:", JSON.stringify(readAcrossBranches(root, "claims", ".json").map((f) => `${f.name}@${f.ref}`)))
