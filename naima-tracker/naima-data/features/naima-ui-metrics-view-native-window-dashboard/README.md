# naima ui: the metrics view in a native window, the dashboard's first view

`naima ui` opens the project's metrics in a native window titled "Naima": a
local server, bound to the loopback interface on a free port and refusing any
request without the run's token, serves the metrics view rendered live from
the recorded data, with a metric picker and a commit range. Closing the window
stops the server.

- The window is the webview binding from JSR, pinned, loaded only by `naima ui`
  and in a process of its own; the rest of Naima keeps zero dependencies.
- When the window cannot open (no Deno, an unsupported system, offline on the
  first run) the default browser opens instead, said in one line;
  `naima ui --browser` asks for the browser.
- The launcher grants the loopback network and the window's program to `ui`
  alone; every other command keeps its permissions.
- It is the first view of the dashboard: plugins contribute views to a
  `ui-views` extension point, and the metrics plugin is the first.

Design is not part of this item: the page is functional.
