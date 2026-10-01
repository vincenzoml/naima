// The program's entry point. The launcher (naima.ts) runs it under Deno with
// the permissions docs/guide/install.md lists; run directly, it is the development
// build, which aligns nothing and moves nothing.

import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { firstParty } from "./builtins.ts"
import { runCli } from "./core/internal.ts"

/** The Naima that is running: the directory above src/. */
const programRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const data = process.env["NAIMA_DATA"]
const cache = process.env["NAIMA_CACHE"]

process.exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  programRoot,
  ...(data ? { data } : {}),
  ...(cache ? { cache } : {}),
  launched: process.env["NAIMA_LAUNCHED"] === "1",
  debug: process.env["NAIMA_DEBUG"] === "1",
  firstParty,
})
