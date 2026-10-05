// Dependencies: what an item waits on, read as a plan.
//
// `blocked-by` (inverse `blocks`) is a core relation: "must be resolved
// before". Read over every open item it is a directed graph, and the graph is
// the plan: what can start now (`naima ready`), the whole order with how many
// waits stand before each item (`naima order`), and a cycle -- items waiting
// on each other, so none of them can ever start -- is a defect the check
// names (`dependencies-acyclic`).
//
// Only open items count. A blocker that is settled (its status is in the done
// category, or it has been archived) holds nothing back.
//
// Every walk below is iterative: a plan can be deep, and a recursive walk is a
// stack overflow waiting for a long enough chain.

import { bool, byUrgency, type Check, type Command, type Context, type Finding, hasTrait, isOpen, type Item, label, linked, parse } from "../../core/api.ts"

const WAITS_ON = "blocked-by"

/** The trait of a type whose items group others (an epic): such an item stands for what it groups. */
export const GROUP = "group"
const HAS_PART = "has-part"

/** A group with members: done by its items, so never itself the work. */
const groups = (ctx: Context, item: Item): boolean => hasTrait(ctx, item, GROUP) && linked(ctx, item, HAS_PART).length > 0

/** What an item stands for: itself, or -- a group with members -- its members, a nested group's too. */
export function standsFor(ctx: Context, item: Item): Item[] {
  const out: Item[] = []
  const seen = new Set<Item>()
  const stack = [item]
  while (stack.length) {
    const i = stack.pop() as Item
    if (seen.has(i)) continue
    seen.add(i)
    if (groups(ctx, i)) stack.push(...linked(ctx, i, HAS_PART).reverse())
    else out.push(i)
  }
  return out
}

/** For every open item that is work -- a group is not -- the open items it waits on; a wait on a group is a wait on its items. */
function waits(ctx: Context): { open: Item[]; on: Map<Item, Item[]> } {
  const open = ctx.repo.items.filter((i) => isOpen(ctx, i) && !groups(ctx, i))
  const openSet = new Set(open)
  const on = new Map(open.map((i) => [i, [...new Set(linked(ctx, i, WAITS_ON).flatMap((b) => standsFor(ctx, b)))].filter((b) => openSet.has(b))]))
  return { open, on }
}

export interface Placed {
  item: Item
  /** How many waits stand before it: 0 for an item that waits on nothing open. */
  depth: number
}

/**
 * A topological order of the open items, layer by layer (Kahn's algorithm): an
 * item comes after everything it waits on, its depth is the longest chain of
 * waits before it, and within a layer the more urgent come first. Items on a
 * cycle, or waiting on one, never become free: they are returned apart.
 */
export function dependencyOrder(ctx: Context): { order: Placed[]; stuck: Item[] } {
  const { open, on } = waits(ctx)
  const pending = new Map(open.map((i) => [i, on.get(i)?.length ?? 0]))
  const dependents = new Map<Item, Item[]>(open.map((i) => [i, []]))
  for (const i of open) for (const b of on.get(i) ?? []) dependents.get(b)?.push(i)
  const depth = new Map<Item, number>()
  const order: Placed[] = []
  let layer = byUrgency(ctx, open.filter((i) => pending.get(i) === 0))
  for (const i of layer) depth.set(i, 0)
  while (layer.length) {
    const next: Item[] = []
    for (const i of layer) {
      const d = depth.get(i) ?? 0
      order.push({ item: i, depth: d })
      for (const after of dependents.get(i) ?? []) {
        depth.set(after, Math.max(depth.get(after) ?? 0, d + 1))
        const left = (pending.get(after) ?? 0) - 1
        pending.set(after, left)
        if (left === 0) next.push(after)
      }
    }
    layer = byUrgency(ctx, next)
  }
  const placed = new Set(order.map((p) => p.item))
  return { order, stuck: open.filter((i) => !placed.has(i)) }
}

/** The cycles among the open items: each strongly connected set of two or more (Tarjan, with an explicit stack). */
export function dependencyCycles(ctx: Context): Item[][] {
  const { open, on } = waits(ctx)
  let next = 0
  const index = new Map<Item, number>()
  const low = new Map<Item, number>()
  const onStack = new Set<Item>()
  const stack: Item[] = []
  const cycles: Item[][] = []
  const visit = (v: Item) => {
    index.set(v, next)
    low.set(v, next)
    next += 1
    stack.push(v)
    onStack.add(v)
  }
  for (const root of open) {
    if (index.has(root)) continue
    visit(root)
    const calls: [Item, number][] = [[root, 0]]
    while (calls.length) {
      const top = calls[calls.length - 1] as [Item, number]
      const [v, at] = top
      const succ = on.get(v) ?? []
      if (at < succ.length) {
        top[1] = at + 1
        const w = succ[at] as Item
        if (!index.has(w)) {
          visit(w)
          calls.push([w, 0])
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0))
        }
        continue
      }
      calls.pop()
      const caller = calls[calls.length - 1]?.[0]
      if (caller) low.set(caller, Math.min(low.get(caller) ?? 0, low.get(v) ?? 0))
      if (low.get(v) !== index.get(v)) continue
      const component: Item[] = []
      for (;;) {
        const w = stack.pop() as Item
        onStack.delete(w)
        component.push(w)
        if (w === v) break
      }
      if (component.length > 1) cycles.push(component.sort((a, b) => label(a).localeCompare(label(b))))
    }
  }
  return cycles
}

type Scope = (ctx: Context, gate?: string) => Item[]

const shown = (ctx: Context, scope: Scope, gate: string | undefined): (i: Item) => boolean => {
  if (gate === undefined) return () => true
  const on = new Set(scope(ctx, gate))
  return (i) => on.has(i)
}

/** `naima ready`: what can start now. */
export function readyCommand(scope: Scope): Command {
  return {
    name: "ready",
    says:
      "the open items that wait on nothing still open -- every `blocked-by` target settled -- most urgent first: what can start now; on a gate, only its items",
    enforces: "nothing: it prints derived state, never stored",
    usage: "ready [gate] [--json]",
    options: [{ name: "--json", says: "print the items as data" }],
    examples: ["ready", "ready first-public"],
    run(args, ctx) {
      const p = parse(args, { json: { type: "boolean" } })
      const gate = p.positionals[0]
      const keep = shown(ctx, scope, gate)
      const { order, stuck } = dependencyOrder(ctx)
      const ready = order.filter((o) => o.depth === 0 && keep(o.item)).map((o) => o.item)
      const open = order.length + stuck.length
      if (bool(p, "json")) {
        ctx.out(JSON.stringify(ready.map((i) => ({ item: label(i), title: i.meta.title })), null, 2))
        return 0
      }
      ctx.out(`${gate ?? "all items"}: ${ready.length} ready of ${open} open`)
      for (const i of ready) ctx.out(`  ${label(i)}  ${i.meta.title}`)
      const cyclic = stuck.filter(keep).length
      if (cyclic) ctx.out(`  ${cyclic} wait on a cycle and can never start -- naima check names it`)
      return 0
    },
  }
}

/** `naima order`: the whole plan, in an order that respects every wait. */
export function orderCommand(scope: Scope): Command {
  return {
    name: "order",
    says:
      "every open item in an order that puts it after everything it waits on (`blocked-by`), with its depth -- how many waits stand before it; items stuck on a cycle are listed apart",
    enforces: "nothing: it prints derived state, never stored",
    usage: "order [gate] [--json]",
    options: [{ name: "--json", says: "print the order as data" }],
    examples: ["order", "order first-public"],
    run(args, ctx) {
      const p = parse(args, { json: { type: "boolean" } })
      const gate = p.positionals[0]
      const keep = shown(ctx, scope, gate)
      const { order, stuck } = dependencyOrder(ctx)
      const rows = order.filter((o) => keep(o.item))
      const blocked = stuck.filter(keep)
      if (bool(p, "json")) {
        ctx.out(
          JSON.stringify({ order: rows.map((o) => ({ item: label(o.item), title: o.item.meta.title, depth: o.depth })), stuck: blocked.map(label) }, null, 2),
        )
        return 0
      }
      const deepest = rows.reduce((m, o) => Math.max(m, o.depth), 0)
      ctx.out(`${gate ?? "all items"}: ${rows.length} in order, deepest wait ${deepest}${blocked.length ? `; ${blocked.length} stuck on a cycle` : ""}`)
      const width = String(deepest).length
      for (const o of rows) ctx.out(`  ${String(o.depth).padStart(width)}  ${label(o.item)}  ${o.item.meta.title}`)
      for (const i of blocked) ctx.out(`  ${"-".padStart(width)}  ${label(i)}  ${i.meta.title}  (waits on a cycle)`)
      return 0
    },
  }
}

/** The check: a cycle of waits is a plan that can never start. */
export const dependenciesAcyclic: Check = {
  name: "dependencies-acyclic",
  says: "no open items wait on each other in a cycle of blocked-by links: none of them could ever start",
  run(ctx) {
    const out: Finding[] = []
    for (const cycle of dependencyCycles(ctx)) {
      const [first] = cycle
      if (!first) continue
      out.push({
        level: "problem",
        message: `a cycle of blocked-by links: ${cycle.map(label).join(", ")} wait on each other, so none can ever start -- remove one of the links`,
        item: first,
      })
    }
    return out
  },
}
