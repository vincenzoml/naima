// How a contribution is called where a person reads it: its short name while
// no other contribution of its kind shares it, else its qualified id.

import type { Context, Contribution } from "./types.ts"

/** `c`'s short name, or its qualified id when another contribution of `kind` goes by the same name. */
export function shortOrId(ctx: Pick<Context, "registry">, kind: string, c: Contribution): string {
  return ctx.registry.contributions(kind).some((o) => o !== c && o.name === c.name) ? c.id : c.name
}
