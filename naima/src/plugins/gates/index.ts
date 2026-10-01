// Gates: named release or merge conditions, backed by items.
//
// A gate is the set of items that must be settled before something may
// happen. It is configured, never hard-coded, in this plugin's options in the
// project's naima-tracker/naima-data/naima.json:
//
//   "plugins": { "gates": { "options": { "gates": {
//     "v1": { "title": "First public release", "says": "…", "holdsOn": "code" } } } } }
//
// holdsOn "code"  (default) the gate waits for code, not for proof: an item
//                 that is fixed and owes only its proving gesture, and the
//                 gestures themselves, are owed but do not block — unless
//                 refuted: a failed test, a violated property, blocks.
// holdsOn "proof" every open item on the gate blocks it.
//
// Any plugin may contribute gates through the contract; `naima gates` lists
// them all, whoever declared them.

import {
  bool,
  type Check,
  code,
  type Command,
  type Context,
  CONTRACT,
  type Contribution,
  DATA_FILE,
  DEFAULT_DATA,
  type ExtensionPoint,
  fieldValue,
  fieldValues,
  type Finding,
  groupBy,
  isEvidenceType,
  isOpen,
  type Item,
  label,
  linked,
  type Migration,
  parse,
  type Plugin,
  refutes,
  rendered,
  type SummarySection,
  table,
} from "../../core/api.ts"

export interface GateResult {
  holds: boolean
  /** What stops the gate. */
  blocking: Item[]
  /** What is still owed but does not stop it. */
  owed: Item[]
}

/** A named release or merge condition, backed by items: what any plugin contributes to the `gates` point. */
export interface GateDef {
  name: string
  title: string
  says: string
  /** How `evaluate` decides: what blocks the gate and what is only owed. */
  decides?: string
  /** Declared by the project's configuration, not the program: the program's reference leaves it out. */
  configured?: boolean
  /** May be async: a gate backed by an external tool awaits it. */
  evaluate(ctx: Context): GateResult | Promise<GateResult>
}

const blank = (s: unknown): boolean => typeof s !== "string" || !s.trim()

/** The point this plugin declares: every plugin's gates, `naima gates` lists them all. */
export const gatesPoint: ExtensionPoint<GateDef> = {
  id: "gates",
  says: "a named release or merge condition, backed by items: `title`, `says`, `decides`, `evaluate(ctx) → { holds, blocking, owed }`",
  noun: "gate",
  stored: true,
  key: (g) => g.name,
  renamed: (g, name) => ({ ...g, name }),
  validate: (v) => {
    const g = v as Partial<GateDef> | null
    if (!g || typeof g !== "object") return "is not an object"
    if (typeof g.name !== "string" || typeof g.title !== "string") return "has no name or title"
    return typeof g.evaluate === "function" ? null : "has no evaluate function"
  },
  gaps: (g) => [...(blank(g.says) ? ["does not say what it is for"] : []), ...(blank(g.decides) ? ["does not say how it decides"] : [])],
  // A gate the project configures is the project's, not the program's: it is not in the program's reference.
  configured: (g) => g.configured === true,
  document: (gates) => [
    "",
    "**Gates**, listed by `naima gates`",
    ...table(["Gate", "Title", "What it is for", "How it decides"], gates.map((g) => [code(g.name), g.title, g.says, g.decides ?? ""])),
  ],
}

/** Every gate any loaded plugin contributes, by name. */
export const gatesOf = (ctx: Context): Contribution<GateDef>[] => ctx.registry.contributions("gates") as Contribution<GateDef>[]

export interface GateConfig {
  title: string
  says?: string
  holdsOn?: "code" | "proof"
}

function readOptions(options: Record<string, unknown>): Record<string, GateConfig> {
  const gates = options["gates"] ?? {}
  if (!gates || typeof gates !== "object" || Array.isArray(gates)) throw new Error("gates: options.gates must be an object")
  for (const [name, g] of Object.entries(gates as Record<string, unknown>)) {
    const c = g as Partial<GateConfig> | null
    if (!c || typeof c.title !== "string") throw new Error(`gates: gate "${name}" needs a title`)
    if (c.holdsOn !== undefined && c.holdsOn !== "code" && c.holdsOn !== "proof") throw new Error(`gates: gate "${name}": holdsOn is "code" or "proof"`)
  }
  return gates as Record<string, GateConfig>
}

// The fields gates reads: its own, and the trackers' it cooperates through by name.
const GATE = { name: "gate", kind: "enum" } as const

/** The gates an item is on: one, several, or none. */
const onGates = (item: Item): string[] => fieldValues(item, GATE)
const FIXED_ON = { name: "fixedOn", kind: "date" } as const
const RUN_BY = { name: "runBy", kind: "enum" } as const
const HUMAN_BECAUSE = { name: "humanBecause", kind: "enum" } as const

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** Format 1 → 2: the project's gates, once a top-level key of naima.json, are this plugin's own options. */
export const moveGates: Migration = {
  from: 1,
  says: "the top-level gates key of naima.json moves to plugins.gates.options.gates",
  config({ gates, ...raw }) {
    if (gates === undefined || (isObject(gates) && !Object.keys(gates).length)) return raw
    const plugins = isObject(raw["plugins"]) ? raw["plugins"] : {}
    const entry = isObject(plugins["gates"]) ? plugins["gates"] : {}
    const options = isObject(entry["options"]) ? entry["options"] : {}
    return { ...raw, plugins: { ...plugins, gates: { ...entry, options: { ...options, gates } } } }
  },
}

/** Refuted, by its own status or by an item verifying it: evidence against it, which blocks under either rule. */
const refuted = (ctx: Context, item: Item): boolean => refutes(ctx, item) || linked(ctx, item, "verified-by").some((v) => refutes(ctx, v))

/** Fixed but unproven, or itself a proving gesture — and not refuted: owed, not blocking, under holdsOn "code". */
const owesOnlyProof = (ctx: Context, item: Item): boolean => !refuted(ctx, item) && (fieldValue(item, FIXED_ON) !== undefined || isEvidenceType(ctx, item.type))

export function evaluateGate(ctx: Context, name: string, holdsOn: "code" | "proof"): GateResult {
  const open = ctx.repo.items.filter((i) => onGates(i).includes(name) && isOpen(ctx, i))
  const blocking = holdsOn === "proof" ? open : open.filter((i) => !owesOnlyProof(ctx, i))
  const owed = open.filter((i) => !blocking.includes(i))
  return { holds: blocking.length === 0, blocking, owed }
}

/** Who can perform an item's proof: its own `runBy`, else that of an item verifying it. */
export function runByOf(ctx: Context, item: Item): string {
  const own = fieldValue(item, RUN_BY)
  if (own !== undefined) return own
  for (const v of linked(ctx, item, "verified-by")) {
    const theirs = fieldValue(v, RUN_BY)
    if (theirs !== undefined) return theirs
  }
  return ""
}

const gatesCommand: Command = {
  name: "gates",
  says: "every gate, whoever declared it, and whether it holds; --check exits 1 if one does not",
  usage: "gates [name...] [--check]",
  options: [{ name: "--check", says: "exit 1 when a listed gate does not hold" }],
  examples: ["gates", "gates first-public --check"],
  async run(args, ctx) {
    const p = parse(args, { check: { type: "boolean" } })
    const names = gatesOf(ctx).map((g) => g.name)
    const wanted = p.positionals.length ? p.positionals : names
    let failed = 0
    for (const name of wanted) {
      const gate = ctx.registry.find<GateDef>("gates", name)?.value
      if (!gate) throw new Error(`no gate "${name}" — gates: ${names.join(", ") || "none configured"}`)
      const r = await gate.evaluate(ctx)
      if (!r.holds) failed++
      ctx.out(`${gate.name} — ${gate.title}: ${r.holds ? "HOLDS" : `BLOCKED by ${r.blocking.length}`}${r.owed.length ? `, ${r.owed.length} owed` : ""}`)
      for (const i of r.blocking) ctx.out(`  ✗ ${label(i)}  ${i.meta.title}`)
      for (const i of r.owed) ctx.out(`  · ${label(i)}  ${i.meta.title}`)
    }
    return bool(p, "check") && failed ? 1 : 0
  },
}

const queue: Command = {
  name: "queue",
  says: "open items on a gate, split by whose hands the proof needs",
  usage: "queue [gate] [--human]",
  options: [{ name: "--human", says: "also list the items that need a person or a build, with why" }],
  examples: ["queue", "queue first-public --human"],
  run(args, ctx) {
    const p = parse(args, { human: { type: "boolean" } })
    const gate = p.positionals[0]
    const open = ctx.repo.items.filter((i) => isOpen(ctx, i) && (gate ? onGates(i).includes(gate) : onGates(i).length > 0))
    const by = groupBy(open, (i) => {
      const who = runByOf(ctx, i)
      return who === "agent" || who === "agent-hands" ? "agent" : who || "unclassified"
    })
    const noCode = open.filter((i) => !owesOnlyProof(ctx, i)).length
    ctx.out(
      `${gate ?? "all gates"}: ${open.length} open — ${["agent", "human", "build", "unclassified"].map((b) => `${b} ${by.get(b)?.length ?? 0}`).join(", ")}`,
    )
    ctx.out(`  with no code yet: ${noCode}; owing only proof: ${open.length - noCode}`)
    if (bool(p, "human")) {
      for (const i of [...(by.get("human") ?? []), ...(by.get("build") ?? [])]) {
        const why = fieldValue(i, HUMAN_BECAUSE) ?? runByOf(ctx, i)
        ctx.out(`  ${label(i)}  ${i.meta.title}  (${why})`)
      }
    }
    return 0
  },
}

const gatedProofIsGated: Check = {
  name: "gated-proof-is-gated",
  says: "an open item that verifies an open gated item carries a gate itself",
  run(ctx) {
    const out: Finding[] = []
    for (const item of ctx.repo.items) {
      if (onGates(item).length || !isOpen(ctx, item)) continue
      for (const target of linked(ctx, item, "verifies")) {
        if (onGates(target).length && isOpen(ctx, target)) {
          out.push({ level: "problem", message: `${label(item)} verifies ${label(target)} (gate ${onGates(target).join(", ")}) but has no gate`, item })
        }
      }
    }
    return out
  },
}

export default function gates(options: Record<string, unknown> = {}): Plugin {
  const configured = readOptions(options)
  const defs: GateDef[] = Object.entries(configured).map(([name, c]) => ({
    name,
    configured: true,
    title: c.title,
    says: c.says ?? "",
    decides: (c.holdsOn ?? "code") === "code"
      ? `blocked by every open item with gate=${name} that still owes code: no fixedOn, and not itself a proving gesture. Fixed items and open proving gestures are owed, not blocking — unless refuted: one whose status refutes (a failed test, a violated property), or one verified by such an item, blocks.`
      : `blocked by every open item with gate=${name}, proof included.`,
    evaluate: (ctx) => evaluateGate(ctx, name, c.holdsOn ?? "code"),
  }))
  const status: SummarySection = {
    name: "gates",
    async render(ctx) {
      const data = await Promise.all(
        gatesOf(ctx).map(async ({ value: g }) => {
          const r = await g.evaluate(ctx)
          return { gate: g.name, holds: r.holds, blocking: r.blocking.map(label), owed: r.owed.map(label) }
        }),
      )
      return rendered(
        data,
        (gs) =>
          gs.map((g) => `  ${g.gate.padEnd(16)} ${g.holds ? "holds" : `blocked by ${g.blocking.length}`}${g.owed.length ? `, ${g.owed.length} owed` : ""}`),
      )
    },
  }
  return {
    name: "gates",
    contract: CONTRACT,
    says: "named release conditions backed by items",
    about:
      "A gate is the set of items that must be settled before something may happen — a release, a merge. An item joins a gate by carrying `gate: <name>`. " +
      "Gates are configured, never hard-coded, and any plugin may contribute one through the contract; `naima gates` lists them all.",
    options: [
      {
        name: "gates",
        says:
          `\`plugins.gates.options.gates\` in \`${DEFAULT_DATA}/${DATA_FILE}\`: gate name → { "title", "says", "holdsOn" }. holdsOn "code" (the default) waits for code, not proof: a fixed item that owes only its proving gesture, and the gestures themselves, are owed but do not block. holdsOn "proof": every open item on the gate blocks it.`,
        default: "{}",
      },
    ],
    fields: [
      {
        name: "gate",
        kind: "enum",
        says: "the gates this item is what is waited for: any gate a loaded plugin contributes — the project's own, or a plugin's — one, or a list of several",
        // Its values are every gate any loaded plugin contributes, configured or not; an item may be on several.
        valuesFrom: "gates",
        multiple: true,
      },
    ],
    points: [gatesPoint],
    // What it reads of the trackers' vocabulary: without it loaded, gates would decide on nothing.
    uses: { fields: [FIXED_ON.name, RUN_BY.name, HUMAN_BECAUSE.name], relations: ["verifies", "verified-by"] },
    contributes: { gates: defs },
    migrations: [moveGates],
    rank: [{ name: "gate", score: (i) => (onGates(i).length ? 0 : 4) }],
    checks: [gatedProofIsGated],
    commands: [gatesCommand, queue],
    summary: [status],
  }
}
