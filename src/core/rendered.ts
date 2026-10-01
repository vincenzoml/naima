// What views and summary sections render: data, and the ways it reads —
// text, markdown, JSON — so a renderer never derives the data again.

import type { Rendered } from "./types.ts"

/** A rendering of `data`: its lines of text, and its markdown when it has one of its own. */
export function rendered<D>(data: D, text: (data: D) => string[], markdown?: (data: D) => string[]): Rendered<D> {
  return Object.freeze({ data, text: () => text(data), ...(markdown ? { markdown: () => markdown(data) } : {}) })
}

/** The formats a rendering is printed in. */
export const FORMATS = ["text", "json", "markdown"] as const
export type Format = (typeof FORMATS)[number]

/**
 * A view's or a section's result, as a rendering: a contract-1 plugin
 * returns its lines, which are its text and its data both.
 */
export function asRendered(result: unknown, what: string): Rendered {
  if (Array.isArray(result) && result.every((l) => typeof l === "string")) return rendered(result as string[], (lines) => lines)
  const r = result as Partial<Rendered> | null
  if (r && typeof r === "object" && "data" in r && typeof r.text === "function") return r as Rendered
  throw new TypeError(`${what} returned ${JSON.stringify(result) ?? String(result)}, not a rendering: { data, text() }, made by rendered(data, text)`)
}

/** A rendering's lines in `format`: its text, its data as JSON, or its markdown — its text when it has none of its own. */
export function linesAs(r: Rendered, format: Format): string[] {
  if (format === "json") return [JSON.stringify(r.data, null, 2)]
  if (format === "markdown") return r.markdown ? r.markdown() : r.text()
  return r.text()
}
