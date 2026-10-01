// The UI: `naima ui` shows the views plugins contribute in a native window:
// first a screen of panels — the summary, which this plugin renders from the
// core's summary sections, the gates and what is next — then the tabs, the
// metrics first; served by a local server that lives as
// long as the window does. It is the first piece of the dashboard: a new
// plugin's view appears without this plugin knowing that plugin.
//
// The server is server.ts (loopback only, a token per run); where it is shown
// is open.ts (the window, or the browser). The launcher grants `ui`, and no
// other command, the loopback network and the programs that show it
// (docs/guide/install.md#the-permissions).

import {
  bool,
  type Command,
  type Context,
  CONTRACT,
  type ExtensionPoint,
  parse,
  type Plugin,
  shortOrId,
  summarySections,
  table,
  usageError,
} from "../../core/api.ts"
import { browserCommand, denoDir, denoPath, openBrowser, type Opened, openWindow, osName, windowCommand, windowUnavailable } from "./open.ts"
import { serve, type UiView } from "./server.ts"

export type { UiRender, UiView } from "./server.ts"
export { HOST, serve } from "./server.ts"

const blank = (s: unknown): boolean => typeof s !== "string" || !s.trim()

/** The point this plugin declares: every plugin's views, which `naima ui` shows as tabs. */
export const viewsPoint: ExtensionPoint<UiView> = {
  id: "ui-views",
  says:
    "a view `naima ui` shows as a tab, or as a panel of its first screen: `name` (its path), `title`, `says`, `order` (lower first, 0 when absent), `panel` (true: on the first screen, not a tab), `render(params, ctx) → { data, html, css? }`, rendered at each request",
  noun: "ui view",
  key: (v) => v.name,
  validate: (v) => {
    const u = v as Partial<UiView> | null
    if (!u || typeof u !== "object") return "is not an object"
    if (typeof u.name !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(u.name)) return "has no name of lowercase letters, digits and dashes"
    if (typeof u.title !== "string") return "has no title"
    if (u.order !== undefined && !Number.isFinite(u.order)) return "has an order that is not a number"
    return typeof u.render === "function" ? null : "has no render function"
  },
  gaps: (v) => (blank(v.says) ? ["does not say what it shows"] : []),
  document: (
    vs,
  ) => [
    "",
    "**UI views**, the tabs of `naima ui`",
    ...table(["View", "Title", "Where", "What it shows"], vs.map((v) => [`\`${v.name}\``, v.title, v.panel ? "first screen" : "tab", v.says])),
  ],
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** The summary as a panel of the first screen: every plugin's section, rendered by the function `naima summary` renders with, so the two cannot disagree. */
export const summaryView: UiView = {
  name: "summary",
  title: "Summary",
  says: "where the project stands: every plugin's summary section, as `naima summary` prints it; its data is `naima summary --json`",
  order: -10,
  panel: true,
  async render(_params, ctx) {
    const sections = (await summarySections(ctx)).map((s) => ({ ...s, lines: s.rendering.text() }))
    const html = sections.filter((s) => s.lines.length).map((s) => `<h3>${esc(s.name)}</h3>\n<pre>${esc(s.lines.join("\n"))}</pre>`)
    return {
      data: Object.fromEntries(sections.map((s) => [s.name, s.rendering.data])),
      html: html.length ? html.join("\n") : "<p>No plugin contributes a summary section.</p>",
      css: "pre{margin:0 0 12px;white-space:pre-wrap}h3{margin:12px 0 4px;font-size:1em}",
    }
  },
}

/** Every view a loaded plugin contributes, by its order, then in load order, each served under its short name, or its qualified id when another shares it. */
export function viewsOf(ctx: Context): UiView[] {
  return ctx.registry.contributions("ui-views")
    .map((c) => ({ ...(c.value as UiView), name: shortOrId(ctx, "ui-views", c).replace("/", "-") }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** What `naima ui` does besides serving: each replaced by a test. */
export interface UiDeps {
  /** Why no window can open here, or null. */
  unavailable(): string | null
  window(url: string): Promise<Opened>
  browser(url: string): Promise<Opened>
  /** Resolves when the person stops `naima ui` (Ctrl-C). */
  interrupted(): Promise<void>
  /** Stop listening for Ctrl-C, once `naima ui` is done: a listener left behind would keep the process alive. */
  forget?(): void
  log?(line: string): void
}

const listening: (() => void)[] = []

export const realDeps: UiDeps = {
  unavailable: () => windowUnavailable(denoPath(), osName()),
  window: (url) => openWindow(windowCommand(denoPath()!, url, denoDir(process.env, osName()))),
  browser: (url) => openBrowser(browserCommand(osName(), url)),
  interrupted: () =>
    new Promise((done) => {
      const stop = () => done()
      listening.push(stop)
      process.once("SIGINT", stop)
      process.once("SIGTERM", stop)
    }),
  forget: () => {
    for (const stop of listening.splice(0)) {
      process.removeListener("SIGINT", stop)
      process.removeListener("SIGTERM", stop)
    }
  },
}

/** `naima ui`: serve the views, show them, and stop the server once the window closes, or on Ctrl-C. */
export async function runUi(ctx: Context, flags: { browser: boolean; open: boolean }, deps: UiDeps = realDeps): Promise<number> {
  const served = await serve(ctx, viewsOf(ctx), deps.log ? { log: deps.log } : {})
  try {
    if (!flags.open) {
      ctx.out(`naima ui: serving ${served.url} — open it in a browser; Ctrl-C stops it`)
      await deps.interrupted()
      return 0
    }
    let why = flags.browser ? null : deps.unavailable()
    if (!flags.browser && why === null) {
      const w = await deps.window(served.url)
      if (w.opened && w.how === "window") {
        ctx.out("naima ui: the Naima window is open — closing it stops the server")
        await Promise.race([w.closed, deps.interrupted().then(() => w.stop())])
        return 0
      }
      why = w.opened ? "the window did not open" : w.reason
    }
    const b = await deps.browser(served.url)
    const where = b.opened ? `opened ${served.url} in the browser` : `open ${served.url} in a browser (${b.reason})`
    ctx.out(`naima ui: ${why === null ? "" : `no window — ${why}; `}${where} — Ctrl-C stops the server`)
    await deps.interrupted()
    return 0
  } finally {
    deps.forget?.()
    await served.close()
  }
}

const uiCommand: Command = {
  name: "ui",
  says:
    "show the views the plugins contribute — first the summary, the gates and what is next, then the metrics and the other tabs — in a native window titled Naima, served from this machine only, live from the files; closing the window stops it",
  enforces: "the views are served only on the loopback interface, and every request without this run's token is refused",
  usage: "ui [--browser | --no-open] [--log]",
  options: [
    { name: "--browser", says: "show it in the default browser instead of the window; Ctrl-C stops the server" },
    { name: "--no-open", says: "show it nowhere: print the address, with its token, and serve until Ctrl-C" },
    { name: "--log", says: "print one line per request on stderr: its status, method, path and user agent" },
  ],
  examples: ["ui", "ui --browser"],
  run(args, ctx) {
    const p = parse(args, { browser: { type: "boolean" }, "no-open": { type: "boolean" }, log: { type: "boolean" } })
    if (p.positionals.length || (bool(p, "browser") && bool(p, "no-open"))) throw usageError(this)
    return runUi(ctx, { browser: bool(p, "browser"), open: !bool(p, "no-open") }, bool(p, "log") ? { ...realDeps, log: (l) => ctx.err(l) } : realDeps)
  },
}

export default function ui(): Plugin {
  return {
    name: "ui",
    contract: CONTRACT,
    says: "the views plugins contribute, shown by `naima ui` in a native window, or the browser, from a server on this machine only",
    about:
      "`naima ui` starts a server bound to the loopback interface, on a free port, that refuses every request without the token of its run, and opens it in a native window titled Naima. " +
      "Each view is one a plugin contributes to `ui-views`, rendered from the files at each request, so the window shows what the files hold now. " +
      "The first screen holds the views that are panels — the summary, which this plugin renders from every plugin's summary section exactly as `naima summary` does; the gates, from the gates plugin, as `naima gates` reports them; what is next, from the triage plugin, as `naima view next` ranks it — and every other view is a tab, the metrics plugin's first. " +
      "`/data/<view>` answers the same view's data as JSON, the same data the command prints with `--json`. Closing the window stops the server. " +
      "The window is a webview, loaded from JSR at a pinned version, only by `naima ui`, and in a process of its own: the rest of Naima has no dependency. " +
      "Where it cannot open — on Node or Bun, on a system it does not run on, offline on its first run, when it fetches its library — the default browser opens instead, and `naima ui` says so in one line; " +
      "`--browser` asks for the browser. Only `ui` is granted, by the launcher, the loopback network and the programs that show it.",
    points: [viewsPoint],
    contributes: { "ui-views": [summaryView] },
    commands: [uiCommand],
  }
}
