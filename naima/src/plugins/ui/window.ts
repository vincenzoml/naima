// The window `naima ui` opens: a program of its own, run by Deno only, that
// shows one URL in a native webview titled "Naima" and exits when the window
// closes. It is the one place Naima loads a dependency — the webview binding
// from JSR, at the exact version open.ts pins — and it runs in its own process, with
// the permissions open.ts hands it, so the program itself never loads code
// over the network nor calls native code (docs/guide/install.md#the-permissions).
//
// It says "ready" on stdout once the window exists; anything that stops it
// before then (no FFI, an unsupported system, offline on the first run, when
// the native library is fetched) is said in one line on stderr, exit 3.

import { NOT_LOADED, WEBVIEW } from "./open.ts"

interface WebviewModule {
  Webview: new (debug?: boolean, size?: { width: number; height: number; hint: number }) => {
    title: string
    navigate(url: string): void
    run(): void
  }
}

if (import.meta.main) {
  const [url, title = "Naima"] = Deno.args
  if (!url) {
    console.error("usage: window.ts <url> [title]")
    Deno.exit(2)
  }
  let mod: WebviewModule
  try {
    // A specifier held in a variable: checking and linting the program never fetch it.
    const spec: string = WEBVIEW
    mod = await import(spec) as WebviewModule
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e).split("\n")[0])
    Deno.exit(NOT_LOADED)
  }
  const view = new mod.Webview(false, { width: 1100, height: 820, hint: 0 })
  view.title = title
  view.navigate(url)
  console.log("ready")
  view.run()
  Deno.exit(0)
}
