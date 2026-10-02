// Reading a plugin's manifest: what it contributes to a point, whichever of
// the two ways it says so.

import type { Migration, Plugin } from "./types.ts"

/** What `p` contributes to the point `id`: the top-level key of that name — the typed sugar — then `contributes[id]`. */
export function contributionsOf(p: Plugin, id: string): readonly unknown[] {
  const top = (p as unknown as Record<string, unknown>)[id]
  return [...(Array.isArray(top) ? top : []), ...(p.contributes?.[id] ?? [])]
}

/** A plugin's own migrations, wherever its manifest declares them. */
export const migrationsOf = (p: Plugin): Migration[] => contributionsOf(p, "migrations") as Migration[]
