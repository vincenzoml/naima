// `naima ui`: the server serves the views and their data with the run's
// token, and nothing without it, on the loopback interface only; the window
// is chosen when it can open, the browser when it cannot or when asked; the
// metrics view picks metrics and a commit range; a plugin's view appears as a
// tab without the ui plugin knowing it; the first screen holds the summary,
// the gates and what is next, each panel's data what the command prints with
// --json for the same tree.

import assert from "node:assert/strict"
import { networkInterfaces } from "node:os"
import { test } from "node:test"
import type { Context, Plugin } from "../../../naima/src/core/api.ts"
import { firstPartyPlugins } from "../../../naima/src/builtins.ts"
import { BROWSER_OPENER, permissions, uiGrant } from "../../../naima/src/launcher.ts"
import ui, { runUi, serve, type UiDeps, type UiView, viewsOf } from "../../../naima/src/plugins/ui/index.ts"
import { browserCommand, denoDir, type Opened, WEBVIEW, windowCommand, windowUnavailable } from "../../../naima/src/plugins/ui/open.ts"
import { tempProject } from "../../core/testing.ts"

const hello: UiView = {
  name: "hello",
  title: "Hello",
  says: "a greeting and the parameters it was asked with",
  render: (params) => ({ data: { params }, html: `<p id="hello">hello ${params["who"]?.join(",") ?? ""}</p>` }),
}
const helloPlugin = (): Plugin => ({ name: "hello", says: "a test view", contributes: { "ui-views": [hello] } })

test("the server answers a view and its data with the token, a cookie after it, and refuses every request without it", async () => {
  const p = tempProject([ui(), helloPlugin()])
  // no panel among the views: / is the first tab
  const served = await serve(p.ctx, [hello])
  try {
    const base = `http://${served.host}:${served.port}`
    assert.equal(served.url, `${base}/?token=${served.token}`)
    assert.match(served.token, /^[0-9a-f]{48}$/)
    for (const path of ["/", "/view/hello", "/data/hello", "/view/hello?token=wrong", "/nothing"]) {
      assert.equal((await fetch(base + path)).status, 403, path)
    }
    const first = await fetch(served.url, { redirect: "manual" })
    assert.equal(first.status, 302)
    assert.equal(first.headers.get("location"), "/view/hello")
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0] ?? ""
    assert.match(first.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Strict/)
    const page = await fetch(`${base}/view/hello?who=a&who=b`, { headers: { cookie } })
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.match(html, /<p id="hello">hello a,b<\/p>/)
    assert.match(html, /<nav aria-label="Views"><a href="\/view\/hello" aria-current="page"/)
    const data = await fetch(`${base}/data/hello?token=${served.token}&who=c`)
    assert.equal(data.headers.get("content-type"), "application/json; charset=utf-8")
    assert.deepEqual(await data.json(), { params: { who: ["c"] } })
    assert.equal((await fetch(`${base}/view/nothing`, { headers: { cookie } })).status, 404)
    assert.equal((await fetch(`${base}/view/hello`, { method: "POST", headers: { cookie } })).status, 405)
  } finally {
    await served.close()
    p.cleanup()
  }
})

test("the server binds the loopback interface only: another interface of this machine does not answer", async () => {
  const p = tempProject([ui(), helloPlugin()])
  const served = await serve(p.ctx, viewsOf(p.ctx))
  try {
    assert.equal(served.host, "127.0.0.1")
    const other = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address
    if (other) {
      await assert.rejects(fetch(`http://${other}:${served.port}/?token=${served.token}`, { signal: AbortSignal.timeout(3000) }))
    }
  } finally {
    await served.close()
    p.cleanup()
  }
})

test("a view a plugin contributes is a tab, without the ui plugin knowing that plugin; the metrics view is first among the first-party ones", () => {
  const p = tempProject([...firstPartyPlugins(), helloPlugin()])
  try {
    const views = viewsOf(p.ctx)
    assert.deepEqual(
      views.filter((v) => !v.panel).map((v) => v.name),
      ["metrics", "hello", "timeline", "coverage"],
      "a later order puts a tab after, whatever the load order",
    )
    assert.deepEqual(views.filter((v) => v.panel).map((v) => v.name), ["summary", "gates", "next"], "the first screen: summary, gates, next up")
  } finally {
    p.cleanup()
  }
})

test("the metrics view picks metrics and a range of commits, from the records on disk at each request", async () => {
  const config = { metrics: { commits: { run: ["git", "log", "--oneline"], kind: "count" }, ok: { run: ["git", "--version"] } } }
  const p = tempProject(firstPartyPlugins({ metrics: config }), { git: true })
  const served = await serve(p.ctx, viewsOf(p.ctx))
  try {
    const get = async (q: string) => {
      const r = await fetch(`http://${served.host}:${served.port}/data/metrics?token=${served.token}${q}`)
      assert.equal(r.status, 200)
      return await r.json() as { picked: string[]; commits: { commit: string }[]; from?: string; to?: string; series: { name: string; points: unknown[] }[] }
    }
    assert.deepEqual((await get("")).commits, [])
    for (let i = 0; i < 3; i++) {
      assert.equal(await p.run("metrics", "run", "--record"), 0)
      p.git("add", "-A")
      p.git("commit", "-q", "-m", `commit ${i}`)
    }
    // recorded after the server started: the view reads them now
    const all = await get("")
    assert.equal(all.commits.length, 3)
    assert.deepEqual(all.picked, ["commits", "ok"])
    assert.deepEqual(all.series.map((s) => s.points.length), [3, 3])
    const [c0, c1] = all.commits.map((c) => c.commit)
    const some = await get(`&metric=commits&from=${c1!.slice(0, 8)}&to=${c1!.slice(0, 8)}`)
    assert.deepEqual(some.picked, ["commits"])
    assert.deepEqual(some.series.map((s) => [s.name, s.points.length]), [["commits", 1]])
    assert.equal(some.from, c1)
    // a range given backwards is the same range
    assert.equal((await get(`&from=${c1}&to=${c0}`)).series[0]?.points.length, 2)
    const page = await (await fetch(`http://${served.host}:${served.port}/view/metrics?token=${served.token}&metric=ok`)).text()
    assert.match(page, /<input type="checkbox" name="metric" value="ok" checked> ok/)
    assert.match(page, /<input type="checkbox" name="metric" value="commits"> commits/)
    assert.match(page, /<select name="from">/)
    assert.match(page, /<svg /)
  } finally {
    await served.close()
    p.cleanup()
  }
})

test("the first screen shows the summary, the gates and what is next; each panel's data is what the command prints with --json for the same tree", async () => {
  const p = tempProject([...firstPartyPlugins({ gates: { gates: { beta: { title: "Public beta" } } } }), helloPlugin()])
  const served = await serve(p.ctx, viewsOf(p.ctx))
  try {
    for (const t of ["Export drops rows", "Crash on <empty> input", "Slow board"]) assert.equal(await p.run("new", "bugs", t), 0)
    const titled = (t: string) => p.ctx.repo.items.find((i) => i.meta.title === t)!
    const [a, b] = [titled("Export drops rows"), titled("Crash on <empty> input")]
    assert.equal(await p.run("set", a!.meta.id, "priority=now", "impact=high"), 0)
    assert.equal(await p.run("gate", "add", "beta", a!.meta.id, b!.meta.id), 0)
    p.ctx.reload()
    const cli = async (command: string, ...args: string[]) => {
      p.output.length = 0
      assert.equal(await p.run(command, ...args), 0)
      return JSON.parse(p.output.join("\n"))
    }
    const base = `http://${served.host}:${served.port}`
    const data = async (name: string) => await (await fetch(`${base}/data/${name}?token=${served.token}`)).json()
    // items written after the server started: every request reads them now
    assert.deepEqual(await data("summary"), await cli("summary", "--json"))
    assert.deepEqual(await data("gates"), await cli("gates", "--json"))
    assert.deepEqual(await data("next"), await cli("view", "--json", "next"))
    const gates = await data("gates") as { gate: string; holds: boolean; blocking: { title: string }[] }[]
    assert.deepEqual(gates.filter((g) => g.gate === "beta").map((g) => [g.holds, g.blocking.length]), [[false, 2]])
    const next = await data("next") as { title: string }[]
    assert.equal(next[0]?.title, "Export drops rows", "the most urgent first, as the CLI ranks it")

    const home = await fetch(served.url)
    assert.equal(home.status, 200)
    const html = await home.text()
    assert.match(html, /<nav aria-label="Views"><a href="\/" aria-current="page" [^>]*>Home<\/a><a href="\/view\/metrics"/, "Home is the first tab")
    assert.doesNotMatch(html, /<nav[^\n]*href="\/view\/(summary|gates|next)"/, "a panel is not a tab")
    const order = ["panel-summary", "panel-gates", "panel-next"].map((id) => html.indexOf(`<section class="panel" aria-labelledby="${id}">`))
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]!)), "summary, then gates, then next up")
    assert.match(html, /Blocked by 2/)
    assert.match(html, /Crash on &lt;empty&gt; input/, "titles are escaped")
    assert.match(html, /<th scope="col">Priority<\/th>/)
    assert.doesNotMatch(html, /This panel failed/)
    // a panel is a page of its own too, under the Home tab
    const one = await (await fetch(`${base}/view/gates?token=${served.token}`)).text()
    assert.match(one, /<a href="\/" aria-current="page"/)
  } finally {
    await served.close()
    p.cleanup()
  }
})

test("a panel that fails says so in its place; the rest of the first screen is shown", async () => {
  const broken: UiView = { name: "broken", title: "Broken", says: "fails", panel: true, render: () => Promise.reject(new Error("no <data>")) }
  const p = tempProject([ui(), helloPlugin()])
  const served = await serve(p.ctx, [...viewsOf(p.ctx), broken])
  try {
    const html = await (await fetch(served.url)).text()
    assert.match(html, /<p role="alert">This panel failed: no &lt;data&gt;<\/p>/)
    assert.match(html, /aria-labelledby="panel-summary"/)
  } finally {
    await served.close()
    p.cleanup()
  }
})

/** Deps that record what `naima ui` asked for; `stop()` plays Ctrl-C. */
function fake(window: () => Promise<Opened>, unavailable: string | null = null) {
  const asked: string[] = []
  let stop = () => {}
  const stopped = new Promise<void>((done) => (stop = done))
  const deps: UiDeps = {
    unavailable: () => unavailable,
    window: (url) => (asked.push(`window ${url}`), window()),
    browser: (url) => (asked.push(`browser ${url}`), Promise.resolve({ opened: true, how: "browser" })),
    interrupted: () => stopped,
  }
  return { asked, deps, stop }
}

async function ran(ctx: Context, flags: { browser: boolean; open: boolean }, f: ReturnType<typeof fake>, out: string[]): Promise<number> {
  const running = runUi(ctx, flags, f.deps)
  // once the line is printed, the window or the browser has been asked; then Ctrl-C
  for (let i = 0; i < 200 && !out.some((l) => l.startsWith("naima ui:")); i++) await new Promise((r) => setTimeout(r, 10))
  f.stop()
  return await running
}

test("the window is opened when it can be, and closing it stops the server", async () => {
  const p = tempProject([ui(), helloPlugin()])
  try {
    let close = () => {}
    let url = ""
    const f = fake(() => Promise.resolve({ opened: true, how: "window", closed: new Promise<void>((done) => (close = done)), stop: () => close() }))
    const running = runUi(p.ctx, { browser: false, open: true }, { ...f.deps, window: (u) => ((url = u), f.deps.window(u)) })
    for (let i = 0; i < 200 && !url; i++) await new Promise((r) => setTimeout(r, 10))
    assert.equal((await fetch(url, { redirect: "manual" })).status, 200)
    close()
    assert.equal(await running, 0)
    assert.deepEqual(f.asked.map((a) => a.split(" ")[0]), ["window"])
    assert.deepEqual(p.output, ["naima ui: the Naima window is open — closing it stops the server"])
    await assert.rejects(fetch(url), "the server stopped with the window")
  } finally {
    p.cleanup()
  }
})

test("when the window cannot open, or fails to, the browser opens instead, said in one line", async () => {
  const p = tempProject([ui(), helloPlugin()])
  try {
    const none = fake(() => Promise.reject(new Error("not asked")), "the window needs Deno, and this is Node or Bun")
    assert.equal(await ran(p.ctx, { browser: false, open: true }, none, p.output), 0)
    assert.deepEqual(none.asked.map((a) => a.split(" ")[0]), ["browser"])
    assert.equal(p.output.length, 1)
    assert.match(
      p.output[0]!,
      /^naima ui: no window — the window needs Deno, and this is Node or Bun; opened http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+ in the browser/,
    )
    p.output.length = 0
    const failed = fake(() => Promise.resolve({ opened: false, reason: "error sending request for url (https://github.com/…)" }))
    assert.equal(await ran(p.ctx, { browser: false, open: true }, failed, p.output), 0)
    assert.deepEqual(failed.asked.map((a) => a.split(" ")[0]), ["window", "browser"])
    assert.match(
      p.output.join("\n"),
      /^naima ui: no window — error sending request for url \(https:\/\/github\.com\/…\); opened .* in the browser — Ctrl-C stops the server$/,
    )
  } finally {
    p.cleanup()
  }
})

test("--browser opens the browser and never the window; --no-open opens nothing and prints the address", async () => {
  const p = tempProject([ui(), helloPlugin()])
  try {
    const f = fake(() => Promise.reject(new Error("the window was asked for")))
    assert.equal(await ran(p.ctx, { browser: true, open: true }, f, p.output), 0)
    assert.deepEqual(f.asked.map((a) => a.split(" ")[0]), ["browser"])
    assert.match(p.output.join("\n"), /^naima ui: opened http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+ in the browser — Ctrl-C stops the server$/)
    p.output.length = 0
    const g = fake(() => Promise.reject(new Error("the window was asked for")))
    assert.equal(await ran(p.ctx, { browser: false, open: false }, g, p.output), 0)
    assert.deepEqual(g.asked, [])
    assert.match(p.output.join("\n"), /^naima ui: serving http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]+ — open it in a browser; Ctrl-C stops it$/)
    await assert.rejects(p.run("ui", "--browser", "--no-open"), /usage/)
  } finally {
    p.cleanup()
  }
})

test("the window needs Deno on a system it runs on; its process may only load the webview's library, fetch it from its release, and read Deno's directory", () => {
  assert.match(windowUnavailable(null, "darwin") ?? "", /needs Deno/)
  assert.match(windowUnavailable("/bin/deno", "aix") ?? "", /does not run on aix/)
  assert.equal(windowUnavailable("/bin/deno", "darwin"), null)
  assert.match(WEBVIEW, /^jsr:@webview\/webview@\d+\.\d+\.\d+$/, "the binding is pinned to an exact version")
  const cmd = windowCommand("/bin/deno", "http://127.0.0.1:1/?token=t", "/d")
  assert.equal(cmd[0], "/bin/deno")
  const flags = cmd.filter((a) => a.startsWith("--allow"))
  assert.deepEqual(flags.map((f) => f.split("=")[0]), ["--allow-ffi", "--allow-read", "--allow-write", "--allow-net", "--allow-env"])
  assert.ok(flags.every((f) => f === "--allow-env" || f.includes("=")), "every grant but the environment is scoped")
  assert.ok(cmd.includes("--no-prompt"))
  assert.equal(denoDir({ DENO_DIR: "/x" }, "linux"), "/x")
  assert.equal(denoDir({}, "linux", "/h"), "/h/.cache/deno")
  assert.equal(denoDir({}, "darwin", "/h"), "/h/Library/Caches/deno")
})

test("the launcher grants ui, and no other command, the loopback network, the Deno that opens the window and the browser's opener", () => {
  const fence = { root: "/r", tracker: "/r/t", data: "/r/t/d", program: "/r/t/p", entry: "/r/t/p" }
  for (const command of ["board", "metrics", "view", undefined]) {
    assert.equal(uiGrant(command, "darwin", "/bin/deno"), null)
    assert.ok(!permissions({ ...fence, ui: uiGrant(command, "darwin", "/bin/deno") }).some((f) => f.startsWith("--allow-net") || f.startsWith("--allow-ffi")))
  }
  const flags = permissions({ ...fence, ui: uiGrant("ui", "darwin", "/bin/deno") })
  assert.ok(flags.includes("--allow-net=127.0.0.1"))
  assert.ok(flags.includes("--allow-run=git,/bin/deno,open"))
  assert.ok(!flags.some((f) => f.startsWith("--allow-ffi")), "native code is the window's, never the program's")
  for (const os of ["darwin", "linux", "windows"]) assert.equal(browserCommand(os, "u")[0], BROWSER_OPENER[os], os)
})
