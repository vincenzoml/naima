// The project site as Pages publishes it: site/ as it is, plus the
// documentation rendered from markdown into site-styled HTML under docs/, and
// the repository's star count written into the page when one is given. Run
// by .github/workflows/pages.yml; nothing is fetched at runtime.
//
// The docs root is found, not named: the directory whose README.md is the
// documentation map, at naima/docs/ or docs/. Every markdown page under it
// becomes a page; README.md becomes index.html; a link to another page stays
// relative, a link outside the docs points at the file on GitHub. The nav is
// the links of the map, in its order.
//
// The renderer covers the markdown the docs use (headings, paragraphs,
// lists, fences, tables, quotes, rules; code, links, emphasis); it has no
// dependency, like the program, and runs on Deno, Node and Bun.
//
//   deno run -A scripts/site.ts <out> [--stars <n>]

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, posix, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const REPO_URL = "https://github.com/vincenzoml/naima"
const BLOB = `${REPO_URL}/blob/main/`
const TREE = `${REPO_URL}/tree/main/`

// ---------------------------------------------------------------- markdown

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens. */
export function slug(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s/g, "-")
}

/** The text of inline markdown, as an anchor is computed from it. */
const plain = (s: string): string =>
  s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`([^`]*)`/g, "$1").replace(/\*/g, "").replace(/(^|[^\p{L}\p{N}])_+|_+(?=[^\p{L}\p{N}]|$)/gu, "$1")

export type LinkRewrite = (url: string) => string

/** Inline markdown to HTML: code spans, escapes, links, autolinks, strong, emphasis, hard breaks. */
export function inline(src: string, link: LinkRewrite = (u) => u): string {
  const held: string[] = []
  const hold = (html: string): string => `\uE000${held.push(html) - 1}\uE000`
  let s = src.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _t, code: string) => {
    const c = code.length > 2 && code.startsWith(" ") && code.endsWith(" ") ? code.slice(1, -1) : code
    return hold(`<code>${esc(c.replace(/\n/g, " "))}</code>`)
  })
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, (_, c: string) => hold(esc(c)))
  s = s.replace(/<(https?:\/\/[^\s>]+)>/g, (_, u: string) => hold(`<a href="${esc(u)}">${esc(u)}</a>`))
  s = esc(s)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, text: string, url: string) => {
    const raw = url.replace(/&amp;/g, "&")
    return `<a href="${esc(link(raw))}">${text}</a>`
  })
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>").replace(/__(?=\S)([\s\S]*?\S)__/g, "<strong>$1</strong>")
  s = s.replace(/\*(?=\S)([^*]*?\S)\*/g, "<em>$1</em>").replace(/(^|[^\p{L}\p{N}])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}])/gu, "$1<em>$2</em>")
  s = s.replace(/(?: {2,}|\\)\n/g, "<br>\n")
  return s.replace(/\uE000(\d+)\uE000/g, (_, i: string) => held[Number(i)] as string)
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])(\s+|$)/
const QUOTE = /^ {0,3}> ?/
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

/** A table row's cells: split on pipes outside code spans, \| kept as a pipe. */
function cells(row: string): string[] {
  const out: string[] = []
  let cur = "", code = false
  const r = row.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "")
  for (let i = 0; i < r.length; i++) {
    const c = r[i] as string
    if (c === "\\" && r[i + 1] === "|") {
      cur += "|"
      i++
    } else if (c === "`") {
      code = !code
      cur += c
    } else if (c === "|" && !code) {
      out.push(cur.trim())
      cur = ""
    } else cur += c
  }
  out.push(cur.trim())
  return out
}

const startsBlock = (line: string, next: string | undefined): boolean =>
  FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line) ||
  (line.includes("|") && next !== undefined && TABLE_SEP.test(next))

interface Renderer {
  link: LinkRewrite
  ids: Map<string, number>
}

function blocks(lines: string[], r: Renderer, tight = false): string {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] as string
    if (!line.trim()) {
      i++
      continue
    }
    const fence = FENCE.exec(line)
    if (fence) {
      const mark = fence[1] as string, lang = fence[2] as string
      const indent = (/^ */.exec(line) as RegExpExecArray)[0].length
      const body: string[] = []
      i++
      while (i < lines.length && !new RegExp(`^ {0,3}${mark[0] === "`" ? "`" : "~"}{${mark.length},}\\s*$`).test(lines[i] as string)) {
        body.push((lines[i] as string).replace(new RegExp(`^ {0,${indent}}`), ""))
        i++
      }
      i++
      out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ""}>${esc(body.join("\n"))}</code></pre>`)
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      const n = (heading[1] as string).length, text = heading[2] as string
      const base = slug(plain(text))
      const seen = r.ids.get(base) ?? 0
      r.ids.set(base, seen + 1)
      const id = seen ? `${base}-${seen}` : base
      out.push(`<h${n} id="${esc(id)}">${inline(text, r.link)}</h${n}>`)
      i++
      continue
    }
    if (RULE.test(line)) {
      out.push("<hr>")
      i++
      continue
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1] as string)) {
      const head = cells(line)
      const align = cells(lines[i + 1] as string).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""))
      const td = (tag: string, c: string, k: number) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ""}>${inline(c, r.link)}</${tag}>`
      const rows: string[] = []
      i += 2
      while (i < lines.length && (lines[i] as string).trim() && (lines[i] as string).includes("|")) {
        rows.push(`<tr>${cells(lines[i] as string).map((c, k) => td("td", c, k)).join("")}</tr>`)
        i++
      }
      out.push(`<div class="table"><table><thead><tr>${head.map((c, k) => td("th", c, k)).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`)
      continue
    }
    if (QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length && (lines[i] as string).trim() && (QUOTE.test(lines[i] as string) || body.length)) {
        body.push((lines[i] as string).replace(QUOTE, ""))
        i++
      }
      out.push(`<blockquote>${blocks(body, r)}</blockquote>`)
      continue
    }
    const item = ITEM.exec(line)
    if (item) {
      const ordered = /\d/.test(item[2] as string)
      const start = ordered ? parseInt(item[2] as string, 10) : 1
      const items: string[][] = []
      let loose = false
      while (i < lines.length) {
        const m = ITEM.exec(lines[i] as string)
        if (!m || /\d/.test(m[2] as string) !== ordered) break
        const width = m[0].length === (lines[i] as string).length ? m[0].length + 1 : m[0].length
        const body = [(lines[i] as string).slice(m[0].length)]
        i++
        while (i < lines.length) {
          const l = lines[i] as string
          if (!l.trim()) {
            const nxt = lines.slice(i + 1).find((x) => x.trim())
            if (nxt === undefined || (/^ */.exec(nxt) as RegExpExecArray)[0].length < width) break
            body.push("")
          } else if ((/^ */.exec(l) as RegExpExecArray)[0].length >= width) body.push(l.slice(width))
          else if (body[body.length - 1]?.trim() && !startsBlock(l, lines[i + 1])) body.push(l.trim())
          else break
          i++
        }
        if (body.some((b, k) => !b.trim() && k < body.length - 1)) loose = true
        items.push(body)
        let j = i
        while (j < lines.length && !(lines[j] as string).trim()) j++
        if (j > i && j < lines.length && ITEM.test(lines[j] as string)) {
          const m2 = ITEM.exec(lines[j] as string) as RegExpExecArray
          if (/\d/.test(m2[2] as string) === ordered) {
            loose = true
            i = j
          }
        }
      }
      const tag = ordered ? "ol" : "ul"
      out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ""}>${items.map((b) => `<li>${blocks(b, r, !loose)}</li>`).join("")}</${tag}>`)
      continue
    }
    const para: string[] = [line.trim()]
    i++
    while (i < lines.length && (lines[i] as string).trim() && !startsBlock(lines[i] as string, lines[i + 1])) {
      para.push((lines[i] as string).replace(/^\s+/, ""))
      i++
    }
    const html = inline(para.join("\n"), r.link)
    out.push(tight ? html : `<p>${html}</p>`)
  }
  return out.join("\n")
}

/** Markdown to HTML, and the page's title: its first heading. */
export function renderMarkdown(md: string, link: LinkRewrite = (u) => u): { html: string; title: string } {
  const lines = md.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")
  const h = lines.map((l) => HEADING.exec(l)).find((m) => m)
  return { html: blocks(lines, { link, ids: new Map() }), title: h ? plain(h[2] as string) : "" }
}

// ---------------------------------------------------------------- the site

/** The documentation root, relative to the repository: the directory whose README.md is the map. */
export function findDocsRoot(repo: string): string | undefined {
  return ["naima/docs", "docs"].find((d) => existsSync(join(repo, d, "README.md")))
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

const toPosix = (p: string): string => p.split(sep).join("/")

/** A page's output path, relative to the docs output directory. */
const htmlOf = (page: string): string => page.replace(/(^|\/)README\.md$/, "$1index.html").replace(/\.md$/, ".html")

/**
 * How a link in `page` (relative to the docs root) is published: another page,
 * relative; anything else in the repository, on GitHub; the web, as it is.
 */
export type Kind = (repoPath: string) => "dir" | "file" | "none"

export function rewriteLink(url: string, page: string, docsRoot: string, kind: Kind): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(url)) return url
  const [path = "", frag] = url.split("#", 2)
  const hash = frag === undefined ? "" : `#${frag}`
  if (!path) return url
  const target = posix.normalize(posix.join(docsRoot, posix.dirname(page), path))
  const inDocs = target === docsRoot || target.startsWith(`${docsRoot}/`)
  const asDir = path.endsWith("/") || kind(target) === "dir"
  if (inDocs && (target.endsWith(".md") || (asDir && kind(posix.join(target, "README.md")) === "file"))) {
    const rel = posix.relative(docsRoot, target)
    const dest = target.endsWith(".md") ? htmlOf(rel) : posix.join(rel, "index.html")
    const from = posix.dirname(page)
    const out = posix.relative(from, dest) || "index.html"
    return out + hash
  }
  return (asDir ? TREE : BLOB) + target.replace(/\/$/, "") + hash
}

/** The palette and type tokens, as index.html defines them: one source for every page. */
export function tokensOf(indexHtml: string): string {
  const m = /\/\* palette \*\/([\s\S]*?)\/\* end palette \*\//.exec(indexHtml)
  if (!m) throw new Error("site/index.html: no /* palette */ … /* end palette */ block")
  return m[1] as string
}

const DOCS_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { background: var(--bg); color: var(--fg); font: var(--t-base)/1.6 var(--sans); -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); text-underline-offset: .18em; text-decoration-thickness: 1px; }
  a:hover { text-decoration-thickness: 2px; }
  a:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .top { display: flex; align-items: center; gap: var(--s-5); padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--line); }
  .top .home { font: 850 22px/1 var(--sans); letter-spacing: -.045em; color: var(--fg); text-decoration: none; }
  .top .home b { color: var(--accent); font-weight: inherit; }
  .top .crumb { color: var(--muted); font-size: var(--t-sm); text-decoration: none; }
  .top .gh { margin-left: auto; font-size: var(--t-sm); color: var(--fg); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: var(--s-1) var(--s-3); background: var(--surface); }
  .wrap { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: var(--s-7); max-width: 1080px; margin: 0 auto; padding: var(--s-6) var(--s-4) var(--s-7); }
  nav details { position: sticky; top: var(--s-5); }
  nav summary { font-size: var(--t-sm); color: var(--muted); cursor: pointer; list-style: none; margin-bottom: var(--s-2); }
  nav ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  nav a { display: block; padding: var(--s-1) var(--s-2); border-radius: 6px; color: var(--fg); text-decoration: none; font-size: var(--t-sm); }
  nav a:hover { background: var(--surface); }
  nav a[aria-current="page"] { background: var(--surface); color: var(--accent); font-weight: 600; }
  article { min-width: 0; max-width: 760px; }
  article h1 { font-size: clamp(28px, 5vw, 36px); line-height: 1.15; letter-spacing: -.02em; margin: 0 0 var(--s-5); }
  article h2 { font-size: 22px; letter-spacing: -.01em; margin: var(--s-7) 0 var(--s-3); padding-top: var(--s-2); }
  article h3 { font-size: 18px; margin: var(--s-6) 0 var(--s-2); }
  article h4, article h5, article h6 { font-size: var(--t-base); margin: var(--s-5) 0 var(--s-2); }
  article p, article ul, article ol, article blockquote, article pre, article .table { margin: 0 0 var(--s-4); }
  article li > ul, article li > ol { margin: var(--s-1) 0 0; }
  article li + li { margin-top: var(--s-1); }
  article code { font: .9em var(--mono); background: var(--surface); border: 1px solid var(--line); border-radius: 5px; padding: .05em .3em; }
  article pre { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--s-3) var(--s-4); overflow-x: auto; }
  article pre code { font-size: var(--t-code); background: none; border: 0; padding: 0; line-height: 1.6; }
  article blockquote { border-left: 3px solid var(--accent-line); padding: 0 var(--s-4); color: var(--muted); }
  article hr { border: 0; border-top: 1px solid var(--line); margin: var(--s-6) 0; }
  .table { overflow-x: auto; }
  table { border-collapse: collapse; font-size: var(--t-sm); width: 100%; }
  th, td { text-align: left; vertical-align: top; padding: var(--s-2) var(--s-3); border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; }
  @media (max-width: 800px) {
    .wrap { grid-template-columns: minmax(0, 1fr); gap: var(--s-4); padding-top: var(--s-4); }
    nav details { position: static; border: 1px solid var(--line); border-radius: var(--radius); padding: var(--s-2) var(--s-3); }
    nav summary { margin: 0; }
    nav details[open] summary { margin-bottom: var(--s-2); }
    .top .crumb { display: none; }
  }
`

interface NavLink {
  text: string
  href: string
}

/** The nav: every page the map links to, in its order, once. */
function navOf(mapMd: string, docsRoot: string, kind: Kind): { text: string; page: string }[] {
  const seen = new Set<string>()
  const out: { text: string; page: string }[] = [{ text: "Documentation", page: "index.html" }]
  seen.add("index.html")
  for (const m of mapMd.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const href = rewriteLink(m[2] as string, "README.md", docsRoot, kind)
    if (/^https?:/.test(href)) continue
    const page = href.split("#")[0] as string
    if (seen.has(page)) continue
    seen.add(page)
    const text = plain(m[1] as string).replace(/\/$/, "")
    out.push({ text: text.charAt(0).toUpperCase() + text.slice(1), page })
  }
  return out
}

function docPage(title: string, body: string, tokens: string, nav: NavLink[], current: string, depth: number): string {
  const up = "../".repeat(depth + 1)
  const items = nav.map((n) => `<li><a href="${esc(n.href)}"${n.href === current ? ' aria-current="page"' : ""}>${esc(n.text)}</a></li>`).join("")
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} · Naima` : "Naima documentation")}</title>
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
<style>${tokens}${DOCS_CSS}</style>
</head>
<body>
<header class="top">
  <a class="home" href="${up}" aria-label="Naima, home">N<b>AI</b>MA</a>
  <a class="crumb" href="${"../".repeat(depth)}index.html">Documentation</a>
  <a class="gh" href="${REPO_URL}">GitHub</a>
</header>
<div class="wrap">
  <nav aria-label="Documentation"><details open><summary>Contents</summary><ul>${items}</ul></details></nav>
  <script>if (matchMedia("(max-width: 800px)").matches) document.querySelector("nav details").open = false</script>
  <article>
${body}
  </article>
</div>
</body>
</html>
`
}

/** Write the published site into `out`: site/, the rendered docs, the star count. */
export function buildSite(repo: string, out: string, options: { stars?: number } = {}): { pages: string[]; docsRoot: string } {
  const docsRoot = findDocsRoot(repo)
  if (!docsRoot) throw new Error("no documentation map: neither naima/docs/README.md nor docs/README.md")
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  cpSync(join(repo, "site"), out, { recursive: true })

  const indexPath = join(out, "index.html")
  let index = readFileSync(indexPath, "utf8")
  if (options.stars !== undefined && Number.isFinite(options.stars)) {
    index = index.replace(/<span class="stars" hidden><\/span>/, `<span class="stars">${options.stars.toLocaleString("en-US")}</span>`)
  }
  writeFileSync(indexPath, index)
  const tokens = tokensOf(index)

  const root = join(repo, docsRoot)
  const kind: Kind = (p) => {
    try {
      return statSync(join(repo, p)).isDirectory() ? "dir" : "file"
    } catch {
      return "none"
    }
  }
  const nav = navOf(readFileSync(join(root, "README.md"), "utf8"), docsRoot, kind)
  const pages = walk(root).map((f) => toPosix(relative(root, f))).filter((p) => p.endsWith(".md")).sort()
  for (const page of pages) {
    const dest = htmlOf(page)
    const depth = dest.split("/").length - 1
    const { html, title } = renderMarkdown(readFileSync(join(root, page), "utf8"), (u) => rewriteLink(u, page, docsRoot, kind))
    const local = nav.map((n) => ({ text: n.text, href: posix.relative(posix.dirname(dest), n.page) || "index.html" }))
    const current = posix.relative(posix.dirname(dest), dest)
    const file = join(out, "docs", ...dest.split("/"))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, docPage(title, html, tokens, local, current, depth))
  }
  return { pages: pages.map(htmlOf), docsRoot }
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
  const repo = dirname(dirname(fileURLToPath(import.meta.url)))
  const built = buildSite(repo, out, stars === undefined ? {} : { stars })
  console.log(`site: ${built.pages.length} pages from ${built.docsRoot}/ into ${out}`)
}
