// The project site as Pages publishes it: site/ as it is, with the
// repository's star count written into the page when one is given. Run by
// .github/workflows/pages.yml; the page fetches nothing at runtime.
//
// Standard APIs only, like the program: it runs on Deno, Node and Bun.
//
//   deno run -A scripts/site.ts <out> [--stars <n>]

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** The palette and type tokens, as index.html defines them, once. */
export function tokensOf(indexHtml: string): string {
  const m = /\/\* palette \*\/([\s\S]*?)\/\* end palette \*\//.exec(indexHtml)
  if (!m) throw new Error("site/index.html: no /* palette */ … /* end palette */ block")
  return m[1] as string
}

/** Write the published site into `out`: site/, and the star count when given. */
export function buildSite(repo: string, out: string, options: { stars?: number } = {}): void {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  cpSync(join(repo, "site"), out, { recursive: true })
  if (options.stars === undefined || !Number.isFinite(options.stars)) return
  const index = join(out, "index.html")
  writeFileSync(
    index,
    readFileSync(index, "utf8").replace(/<span class="stars" hidden><\/span>/, `<span class="stars">${options.stars.toLocaleString("en-US")}</span>`),
  )
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const out = args.find((a, k) => !a.startsWith("--") && args[k - 1] !== "--stars")
  const s = args.indexOf("--stars")
  const stars = s >= 0 && /^\d+$/.test(args[s + 1] ?? "") ? Number(args[s + 1]) : undefined
  if (!out) {
    console.error("usage: deno run -A scripts/site.ts <out> [--stars <n>]")
    process.exit(2)
  }
  buildSite(dirname(dirname(fileURLToPath(import.meta.url))), out, stars === undefined ? {} : { stars })
  console.log(`site: ${out}${stars === undefined ? "" : `, ${stars} stars`}`)
}
