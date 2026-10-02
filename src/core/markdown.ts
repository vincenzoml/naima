// Small markdown helpers for documentation an extension point renders into
// the reference: a code span, a table cell, a sentence, a table.

/** A code span. */
export const code = (s: string): string => "`" + s + "`"

/** Text safe inside a table cell: no pipe ends the cell, no newline the row. */
export const cell = (s: string | undefined): string => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")

/** A `says` line as a sentence: capitalised, with a full stop. */
export function sentence(s: string): string {
  const t = s.trim()
  return (t.charAt(0).toUpperCase() + t.slice(1)).replace(/([^.!?])$/, "$1.")
}

/** A markdown table after a blank line, cells made safe; nothing when there are no rows. */
export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string[] {
  if (!rows.length) return []
  return ["", `| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)]
}
