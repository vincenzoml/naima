// The server `naima ui` runs: plain node:http, so it runs the same on Deno,
// Node and Bun, bound to the loopback interface on a free port. Every request
// carries the run's token — in the URL the window opens, then in a cookie the
// first answer sets — or is refused: another user of the machine, or a page
// in a browser, cannot read the project through it.
//
//   /                     the first view
//   /view/<name>?…        a view's page: the views as tabs, then the view
//   /data/<name>?…        a view's data, as JSON
//
// Each request renders the view again from the files: the page is live.

import { Buffer } from "node:buffer"
import { randomBytes, timingSafeEqual } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import type { Context } from "../../core/api.ts"

/** A view of `naima ui`: what any plugin contributes to the `ui-views` point. */
export interface UiView {
  /** The path it is served at: /view/<name>. */
  name: string
  /** Its tab. */
  title: string
  says: string
  /** Where its tab stands: lower first, 0 when absent; equal ones in load order. */
  order?: number
  /** The view for these query parameters, rendered from the files at each request: its data, its HTML, and the styles that HTML needs. */
  render(params: Record<string, string[]>, ctx: Context): UiRender | Promise<UiRender>
}

export interface UiRender {
  data: unknown
  /** The view's body, inside the page the server makes. */
  html: string
  css?: string
}

export interface Served {
  /** The URL that opens the first view, with the token. */
  url: string
  host: string
  port: number
  token: string
  close(): Promise<void>
}

export const HOST = "127.0.0.1"
const COOKIE = "naima-ui"

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const same = (a: string, b: string): boolean => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const cookieToken = (req: IncomingMessage): string | undefined =>
  (req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=")).find(([k]) => k === COOKIE)?.[1]

/** The page around a view: the views as tabs, then the view. */
function page(views: readonly UiView[], current: UiView, body: string, css = ""): string {
  const tabs = views.map((v) =>
    `<a href="/view/${encodeURIComponent(v.name)}"${v === current ? ' aria-current="page"' : ""} title="${esc(v.says)}">${esc(v.title)}</a>`
  )
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>Naima — ${esc(current.title)}</title>`,
    "<style>",
    css,
    "nav{display:flex;gap:12px;margin-bottom:12px}nav a{color:inherit}nav a[aria-current]{font-weight:700;text-decoration:none}",
    "form.pick{margin:8px 0 16px}fieldset{border:1px solid #8888;margin:0 0 8px}label{margin-right:10px;white-space:nowrap}",
    "</style></head><body>",
    `<nav>${tabs.join("")}</nav>`,
    body,
    "</body></html>",
  ].join("\n")
}

function paramsOf(url: URL): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [k, v] of url.searchParams) if (k !== "token") (out[k] ??= []).push(v)
  return out
}

function send(res: ServerResponse, status: number, type: string, body: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, {
    "content-type": `${type}; charset=utf-8`,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...headers,
  })
  res.end(body)
}

/**
 * Serve the views on the loopback interface, on a free port unless `port` is given, refusing every request without
 * `token` (a fresh random one by default). `log` hears one line per request: its status, method, path and user agent.
 */
export function serve(
  ctx: Context,
  views: readonly UiView[],
  opts: { token?: string; port?: number; log?: (line: string) => void } = {},
): Promise<Served> {
  const token = opts.token ?? randomBytes(24).toString("hex")
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${HOST}`)
    if (opts.log) res.once("finish", () => opts.log?.(`${res.statusCode} ${req.method} ${url.pathname} ${req.headers["user-agent"] ?? ""}`))
    const given = url.searchParams.get("token") ?? cookieToken(req)
    if (!given || !same(given, token)) return send(res, 403, "text/plain", "naima ui: this address needs the token it was opened with\n")
    const headers = { "set-cookie": `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict` }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "text/plain", "naima ui: read only\n", headers)
    let parts: string[]
    try {
      parts = url.pathname.split("/").map((p) => decodeURIComponent(p))
    } catch {
      return send(res, 400, "text/plain", "naima ui: a path that is not one\n", headers)
    }
    const [, kind, name] = parts
    if (url.pathname === "/") {
      const first = views[0]
      if (!first) return send(res, 200, "text/html", "<!doctype html><title>Naima</title><p>No plugin contributes a view.</p>", headers)
      return send(res, 302, "text/plain", "", { ...headers, location: `/view/${encodeURIComponent(first.name)}` })
    }
    const view = views.find((v) => v.name === name)
    if (!view || (kind !== "view" && kind !== "data")) return send(res, 404, "text/plain", `naima ui: no ${url.pathname}\n`, headers)
    try {
      ctx.reload()
      const r = await view.render(paramsOf(url), ctx)
      if (kind === "data") return send(res, 200, "application/json", JSON.stringify(r.data, null, 2), headers)
      return send(res, 200, "text/html", page(views, view, r.html, r.css), headers)
    } catch (e) {
      return send(res, 500, "text/plain", `naima ui: the ${view.name} view failed: ${e instanceof Error ? e.message : String(e)}\n`, headers)
    }
  })
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(opts.port ?? 0, HOST, () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        url: `http://${HOST}:${port}/?token=${token}`,
        host: HOST,
        port,
        token,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections?.()
            server.close(() => done())
          }),
      })
    })
  })
}
