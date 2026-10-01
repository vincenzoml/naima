// Metrics over the commit timeline, drawn: an SVG line chart with no
// dependency, one panel per metric — commit dates along x, the value up y,
// the metric's bound as a dashed line — and an HTML report that holds the
// chart and a table of where each metric started and where it is now.

/** One metric's points along history, as the chart draws them. */
export interface Series {
  name: string
  says?: string
  unit?: string
  better?: "higher" | "lower" | "neither"
  /** The bound, in words and number: "budget", 120. */
  bound?: { word: string; value: number }
  points: { commit: string; date: string; value: number }[]
}

const W = 760
const PANEL = 170
const LEFT = 64
const RIGHT = 20
const TOP = 34
const BOTTOM = 30

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const num = (n: number): string => (Math.abs(n) >= 1000 || Number.isInteger(n) ? String(Math.round(n)) : String(Math.round(n * 100) / 100))

/** Round ticks that cover lo..hi: about four of them, at 1, 2 or 5 times a power of ten. */
export function ticks(lo: number, hi: number, count = 4): number[] {
  if (hi === lo) return [lo]
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step) out.push(Math.round(v / step) * step)
  return out
}

const BETTER_WORDS = { higher: "higher is better", lower: "lower is better", neither: "" }

/** The chart: one panel per series, sharing the time axis. */
export function plotSvg(series: Series[], title = "Metrics over the commit timeline"): string {
  const times = series.flatMap((s) => s.points.map((p) => Date.parse(p.date))).filter(Number.isFinite)
  const t0 = times.length ? Math.min(...times) : 0
  const t1 = times.length ? Math.max(...times) : 1
  const span = t1 - t0 || 1
  const x = (t: number) => LEFT + ((t - t0) / span) * (W - LEFT - RIGHT)
  const H = 28 + Math.max(1, series.length) * PANEL
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">`,
    "<style>",
    "svg{--bg:#ffffff;--fg:#1f2328;--muted:#656d76;--grid:#d8dee4;--line:#0969da;--bound:#cf222e;font-family:system-ui,-apple-system,Segoe UI,sans-serif}",
    "@media (prefers-color-scheme: dark){svg{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--grid:#30363d;--line:#4493f8;--bound:#f85149}}",
    ".bg{fill:var(--bg)}.t{fill:var(--fg);font-size:13px;font-weight:600}.s{fill:var(--muted);font-size:11px}.g{stroke:var(--grid);stroke-width:1}",
    ".l{fill:none;stroke:var(--line);stroke-width:2;stroke-linejoin:round}.p{fill:var(--line)}.b{stroke:var(--bound);stroke-width:1.5;stroke-dasharray:6 4}.bt{fill:var(--bound);font-size:11px}",
    "</style>",
    `<rect class="bg" width="${W}" height="${H}"/>`,
    `<text class="t" x="${LEFT}" y="18">${esc(title)}</text>`,
  ]
  series.forEach((s, k) => {
    const top = 28 + k * PANEL + TOP
    const bottom = 28 + (k + 1) * PANEL - BOTTOM
    const values = s.points.map((p) => p.value)
    const all = s.bound ? [...values, s.bound.value] : values
    let lo = all.length ? Math.min(...all) : 0
    let hi = all.length ? Math.max(...all) : 1
    if (lo === hi) [lo, hi] = [lo - (Math.abs(lo) || 1) * 0.1, hi + (Math.abs(hi) || 1) * 0.1]
    const pad = (hi - lo) * 0.08
    lo -= pad
    hi += pad
    const y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top)
    const unit = s.unit ? ` (${s.unit})` : ""
    const better = s.better ? BETTER_WORDS[s.better] : ""
    out.push(`<g aria-label="${esc(s.name)}">`)
    out.push(`<text class="t" x="${LEFT}" y="${top - 12}">${esc(s.name)}${esc(unit)}</text>`)
    const note = [s.says, better].filter(Boolean).join(" — ")
    if (note) out.push(`<text class="s" x="${W - RIGHT}" y="${top - 12}" text-anchor="end">${esc(note.length > 90 ? `${note.slice(0, 89)}…` : note)}</text>`)
    for (const v of ticks(lo, hi)) {
      if (v < lo || v > hi) continue
      out.push(`<line class="g" x1="${LEFT}" x2="${W - RIGHT}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`)
      out.push(`<text class="s" x="${LEFT - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${num(v)}</text>`)
    }
    if (s.bound) {
      const by = y(s.bound.value).toFixed(1)
      out.push(`<line class="b" x1="${LEFT}" x2="${W - RIGHT}" y1="${by}" y2="${by}"/>`)
      out.push(`<text class="bt" x="${W - RIGHT}" y="${(Number(by) - 4).toFixed(1)}" text-anchor="end">${esc(`${s.bound.word} ${num(s.bound.value)}`)}</text>`)
    }
    const pts = s.points.map((p) => ({ ...p, t: Date.parse(p.date) })).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t)
    if (pts.length > 1) out.push(`<polyline class="l" points="${pts.map((p) => `${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")}"/>`)
    for (const p of pts) {
      out.push(
        `<circle class="p" cx="${x(p.t).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.5"><title>${
          esc(`${p.commit.slice(0, 12)} ${p.date.slice(0, 10)}: ${num(p.value)}${s.unit ? ` ${s.unit}` : ""}`)
        }</title></circle>`,
      )
    }
    if (!pts.length) out.push(`<text class="s" x="${LEFT}" y="${(top + bottom) / 2}">nothing recorded</text>`)
    for (const t of pts.length ? dateTicks(t0, t1) : []) {
      out.push(`<text class="s" x="${x(t).toFixed(1)}" y="${bottom + 16}" text-anchor="middle">${new Date(t).toISOString().slice(0, 10)}</text>`)
    }
    out.push("</g>")
  })
  out.push("</svg>")
  return out.join("\n")
}

/** Up to five dates spread over t0..t1: both ends and the points between. */
function dateTicks(t0: number, t1: number): number[] {
  if (t1 === t0) return [t0]
  return [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + f * (t1 - t0))
}

/** Where a series started and where it is now, and whether that is better. */
export function verdict(s: Series): { first?: number; last?: number; change?: number; reads: string } {
  const first = s.points[0]?.value
  const last = s.points.at(-1)?.value
  if (first === undefined || last === undefined) return { reads: "nothing recorded" }
  const change = Math.round((last - first) * 1000) / 1000
  const reads = change === 0
    ? "unchanged"
    : !s.better || s.better === "neither"
    ? change > 0 ? "up" : "down"
    : (change > 0) === (s.better === "higher")
    ? "better"
    : "worse"
  return { first, last, change, reads }
}

/** A page with the chart and the table: open it in a browser. */
export function htmlReport(series: Series[], title = "Code quality over time"): string {
  const rows = series.map((s) => {
    const v = verdict(s)
    const u = s.unit ? ` ${s.unit}` : ""
    return `<tr><td>${esc(s.name)}</td><td>${esc(s.says ?? "")}</td><td>${v.first === undefined ? "" : `${num(v.first)}${esc(u)}`}</td><td>${
      v.last === undefined ? "" : `${num(v.last)}${esc(u)}`
    }</td><td class="${v.reads}">${esc(v.reads)}${v.change ? ` (${v.change > 0 ? "+" : ""}${num(v.change)})` : ""}</td><td>${s.points.length}</td></tr>`
  })
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${esc(title)}</title>`,
    "<style>",
    ":root{--bg:#ffffff;--fg:#1f2328;--muted:#656d76;--rule:#d8dee4;--good:#1a7f37;--bad:#cf222e}",
    "@media (prefers-color-scheme: dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--rule:#30363d;--good:#3fb950;--bad:#f85149}}",
    "body{background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0 auto;max-width:800px;padding:16px}",
    "svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule)}",
    "th{color:var(--muted);font-weight:600}.better{color:var(--good)}.worse{color:var(--bad)}.wrap{overflow-x:auto}",
    "</style></head><body>",
    `<h1>${esc(title)}</h1>`,
    '<div class="wrap"><table><thead><tr><th>Metric</th><th>What it measures</th><th>First</th><th>Now</th><th>Change</th><th>Commits</th></tr></thead><tbody>',
    ...rows,
    "</tbody></table></div>",
    plotSvg(series, title),
    "</body></html>",
  ].join("\n")
}
