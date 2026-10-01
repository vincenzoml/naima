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
// due, version    a gate with a date is a milestone: `naima gates` and
//                 `naima queue` say the days left, a check warns once it is
//                 past its date and does not hold.
//
// `naima gate new|add|remove|show` declares a gate and puts items on it, so
// nobody edits naima.json by hand. An item whose type carries the `group`
// trait (an epic) stands on a gate for the items it groups (`has-part`).
//
// Any plugin may contribute gates through the contract; `naima gates` lists
// them all, whoever declared them.

import { readFileSync } from "node:fs"
import { join } from "node:path"
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
  hasTrait,
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
  setFields,
  str,
  type SummarySection,
  table,
  today,
  usageError,
  writeJson,
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
  /** A milestone's date, YYYY-MM-DD: `naima gates` says the days left. */
  due?: string
  /** The version a milestone ships as. */
  version?: string
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
  /** A milestone's date, YYYY-MM-DD. */
  due?: string
  /** The version a milestone ships as. */
  version?: string
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (v: unknown): v is string => typeof v === "string" && DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
/** A gate's name: what items carry as `gate=<name>`. */
const GATE_NAME = /^[a-z0-9][a-z0-9._-]*$/

function readOptions(options: Record<string, unknown>): Record<string, GateConfig> {
  const gates = options["gates"] ?? {}
  if (!gates || typeof gates !== "object" || Array.isArray(gates)) throw new Error("gates: options.gates must be an object")
  for (const [name, g] of Object.entries(gates as Record<string, unknown>)) {
    const c = g as Partial<GateConfig> | null
    if (!c || typeof c.title !== "string") throw new Error(`gates: gate "${name}" needs a title`)
    if (c.holdsOn !== undefined && c.holdsOn !== "code" && c.holdsOn !== "proof") throw new Error(`gates: gate "${name}": holdsOn is "code" or "proof"`)
    if (c.says !== undefined && typeof c.says !== "string") throw new Error(`gates: gate "${name}": says is a sentence`)
    if (c.due !== undefined && !isDate(c.due)) throw new Error(`gates: gate "${name}": due is a date, YYYY-MM-DD, got ${JSON.stringify(c.due)}`)
    if (c.version !== undefined && (typeof c.version !== "string" || !c.version.trim())) throw new Error(`gates: gate "${name}": version is a non-empty string`)
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

/** The trait of a type whose items group others (an epic): on a gate, such an item stands for what it groups. */
export const GROUP = "group"
const HAS_PART = "has-part"

/** What an item stands for on a gate: itself, or — a group with members — its members, a nested group's too. */
function standsFor(ctx: Context, item: Item, seen: Set<Item> = new Set()): Item[] {
  if (seen.has(item)) return []
  seen.add(item)
  if (!hasTrait(ctx, item, GROUP)) return [item]
  const members = linked(ctx, item, HAS_PART)
  return members.length ? members.flatMap((m) => standsFor(ctx, m, seen)) : [item]
}

/** The items a gate waits for — those on it, a group standing for its members — or, with no gate named, every gate's. */
export function gatedItems(ctx: Context, name?: string): Item[] {
  const on = ctx.repo.items.filter((i) => (name === undefined ? onGates(i).length > 0 : onGates(i).includes(name)))
  return [...new Set(on.flatMap((i) => standsFor(ctx, i)))]
}

const DAY = 86_400_000
/** Whole days from today to `due`: negative once it is past. */
export const daysLeft = (ctx: Context, due: string): number => Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today(ctx)}T00:00:00Z`)) / DAY)
const days = (n: number): string => `${n} day${n === 1 ? "" : "s"}`

/** A milestone's date and version, in words — "version 0.9; due 2026-02-01, 17 days left" — or "" for a gate with neither. */
export function timing(ctx: Context, g: Pick<GateDef, "due" | "version">): string {
  const parts: string[] = []
  if (g.version) parts.push(`version ${g.version}`)
  if (g.due) {
    const n = daysLeft(ctx, g.due)
    parts.push(`due ${g.due}, ${n > 0 ? `${days(n)} left` : n === 0 ? "today" : `${days(-n)} overdue`}`)
  }
  return parts.join("; ")
}

export function evaluateGate(ctx: Context, name: string, holdsOn: "code" | "proof"): GateResult {
  const open = gatedItems(ctx, name).filter((i) => isOpen(ctx, i))
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

function printGate(ctx: Context, gate: GateDef, r: GateResult, hands = false): void {
  const when = timing(ctx, gate)
  ctx.out(
    `${gate.name} — ${gate.title}${when ? ` (${when})` : ""}: ${r.holds ? "HOLDS" : `BLOCKED by ${r.blocking.length}`}${
      r.owed.length ? `, ${r.owed.length} owed` : ""
    }`,
  )
  const who = (i: Item) => (hands ? `  (${runByOf(ctx, i) || "unclassified"})` : "")
  for (const i of r.blocking) ctx.out(`  ✗ ${label(i)}  ${i.meta.title}${who(i)}`)
  for (const i of r.owed) ctx.out(`  · ${label(i)}  ${i.meta.title}${who(i)}`)
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
      printGate(ctx, gate, r)
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
    const def = gate === undefined ? undefined : ctx.registry.find<GateDef>("gates", gate)?.value
    const when = def ? timing(ctx, def) : ""
    const open = gatedItems(ctx, gate).filter((i) => isOpen(ctx, i))
    const by = groupBy(open, (i) => {
      const who = runByOf(ctx, i)
      return who === "agent" || who === "agent-hands" ? "agent" : who || "unclassified"
    })
    const noCode = open.filter((i) => !owesOnlyProof(ctx, i)).length
    ctx.out(
      `${gate ?? "all gates"}${when ? ` (${when})` : ""}: ${open.length} open — ${
        ["agent", "human", "build", "unclassified"].map((b) => `${b} ${by.get(b)?.length ?? 0}`).join(", ")
      }`,
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

/** The gates the project configures, as they stand in its naima.json. */
const DATA_PATH = (ctx: Context): string => join(ctx.trackerRoot, DATA_FILE)

/** Declare a gate in naima.json, validated as the next load will read it; refused when one by that name exists. */
function declareGate(ctx: Context, name: string, gate: GateConfig): void {
  if (!GATE_NAME.test(name)) {
    throw new Error(`a gate's name is lowercase letters, digits, dots, dashes and underscores, starting with a letter or digit: got ${JSON.stringify(name)}`)
  }
  if (ctx.registry.find("gates", name)) throw new Error(`a gate "${name}" already exists — naima gate show ${name}`)
  const raw = JSON.parse(readFileSync(DATA_PATH(ctx), "utf8")) as Record<string, unknown>
  const plugins = isObject(raw["plugins"]) ? raw["plugins"] : {}
  const entry = isObject(plugins["gates"]) ? plugins["gates"] : {}
  const options = isObject(entry["options"]) ? entry["options"] : {}
  const current = isObject(options["gates"]) ? options["gates"] : {}
  if (Object.hasOwn(current, name)) throw new Error(`a gate "${name}" already exists — naima gate show ${name}`)
  const next = { ...options, gates: { ...current, [name]: gate } }
  readOptions(next)
  writeJson(DATA_PATH(ctx), { ...raw, plugins: { ...plugins, gates: { ...entry, options: next } } })
}

const findGate = (ctx: Context, name: string | undefined): GateDef => {
  const gate = name === undefined ? undefined : ctx.registry.find<GateDef>("gates", name)?.value
  if (!gate) throw new Error(`no gate "${name}" — gates: ${gatesOf(ctx).map((g) => g.name).join(", ") || 'none yet: naima gate new <name> "<title>"'}`)
  return gate
}

const gateCommand: Command = {
  name: "gate",
  says:
    "declare a gate — a milestone, with a date and a version — put items on it or take them off, and show one; writes go to naima.json and to the items, validated, through the write hooks",
  usage:
    'gate new <name> "<title>" [--says <s>] [--due YYYY-MM-DD] [--version <v>] [--holds-on code|proof] | gate add <gate> <item>... | gate remove <gate> <item>... | gate show <gate>',
  options: [
    { name: "--says", says: "gate new: what the gate is for, in one sentence" },
    { name: "--due", says: "gate new: the date it is due, YYYY-MM-DD, which makes it a milestone" },
    { name: "--version", says: "gate new: the version it ships as" },
    { name: "--holds-on", says: 'gate new: "code" (the default) waits for code and lets proof be owed; "proof" waits for every proof too' },
  ],
  examples: [
    'gate new beta "Public beta" --says "the first outside users" --due 2026-12-01 --version 0.9',
    "gate add beta bugs/export-drops-alpha epics/onboarding",
    "gate remove beta bugs/export-drops-alpha",
    "gate show beta",
  ],
  async run(args, ctx) {
    const p = parse(args, { says: { type: "string" }, due: { type: "string" }, version: { type: "string" }, "holds-on": { type: "string" } })
    const [sub, name, ...rest] = p.positionals
    if (sub === "new") {
      const title = rest[0]
      if (!name || !title?.trim() || rest.length > 1) throw usageError(this)
      const says = str(p, "says"), due = str(p, "due"), version = str(p, "version"), holdsOn = str(p, "holds-on")
      const gate = {
        title: title.trim(),
        ...(says !== undefined ? { says } : {}),
        ...(due !== undefined ? { due } : {}),
        ...(version !== undefined ? { version } : {}),
        ...(holdsOn !== undefined ? { holdsOn } : {}),
      } as GateConfig
      declareGate(ctx, name, gate)
      ctx.out(`gate ${name} declared in ${ctx.trackerDir}/${DATA_FILE} — put items on it: naima gate add ${name} <item>...`)
      return 0
    }
    if (sub === "add" || sub === "remove") {
      if (!rest.length) throw usageError(this)
      const gate = findGate(ctx, name)
      const items = rest.map((ref) => ctx.repo.resolve(ref))
      for (const item of items) {
        const on = onGates(item)
        if (sub === "add" && on.includes(gate.name)) continue
        if (sub === "remove" && !on.includes(gate.name)) throw new Error(`${label(item)} is not on gate ${gate.name}`)
        const next = sub === "add" ? [...on, gate.name] : on.filter((g) => g !== gate.name)
        setFields(ctx, item, [[GATE.name, next.join(",")]])
        ctx.out(`${label(item)}: ${sub === "add" ? "on" : "off"} gate ${gate.name}`)
      }
      return 0
    }
    if (sub === "show") {
      if (rest.length) throw usageError(this)
      const gate = findGate(ctx, name)
      const r = await gate.evaluate(ctx)
      printGate(ctx, gate, r, true)
      if (gate.says) ctx.out(`  for: ${gate.says}`)
      if (gate.decides) ctx.out(`  decides: ${gate.decides}`)
      return r.holds ? 0 : 1
    }
    throw usageError(this)
  },
}

const overdue: Check = {
  name: "milestone-overdue",
  says: "warns when a gate with a due date is past it and does not hold",
  async run(ctx) {
    const out: Finding[] = []
    for (const { value: g } of gatesOf(ctx)) {
      if (!g.due || daysLeft(ctx, g.due) >= 0) continue
      const r = await g.evaluate(ctx)
      if (r.holds) continue
      out.push({
        level: "note",
        message: `milestone ${g.name} (${g.title}) was due on ${g.due}, ${
          days(-daysLeft(ctx, g.due))
        } ago, and is blocked by ${r.blocking.length} — naima gate show ${g.name}`,
      })
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
    ...(c.due !== undefined ? { due: c.due } : {}),
    ...(c.version !== undefined ? { version: c.version } : {}),
    decides:
      ((c.holdsOn ?? "code") === "code"
        ? `blocked by every open item with gate=${name} that still owes code: no fixedOn, and not itself a proving gesture. Fixed items and open proving gestures are owed, not blocking — unless refuted: one whose status refutes (a failed test, a violated property), or one verified by such an item, blocks.`
        : `blocked by every open item with gate=${name}, proof included.`) +
      " An item whose type groups others (an epic) stands for the items it groups.",
    evaluate: (ctx) => evaluateGate(ctx, name, c.holdsOn ?? "code"),
  }))
  const status: SummarySection = {
    name: "gates",
    async render(ctx) {
      const data = await Promise.all(
        gatesOf(ctx).map(async ({ value: g }) => {
          const r = await g.evaluate(ctx)
          return { gate: g.name, when: timing(ctx, g), holds: r.holds, blocking: r.blocking.map(label), owed: r.owed.map(label) }
        }),
      )
      return rendered(
        data,
        (gs) =>
          gs.map((g) =>
            `  ${g.gate.padEnd(16)} ${g.holds ? "holds" : `blocked by ${g.blocking.length}`}${g.owed.length ? `, ${g.owed.length} owed` : ""}${
              g.when ? ` (${g.when})` : ""
            }`
          ),
      )
    },
  }
  return {
    name: "gates",
    contract: CONTRACT,
    says: "named release conditions backed by items",
    about:
      "A gate is the set of items that must be settled before something may happen — a release, a merge. An item joins a gate by carrying `gate: <name>`. " +
      "Gates are configured, never hard-coded, and any plugin may contribute one through the contract; `naima gates` lists them all. " +
      "`naima gate new` declares one in the project's configuration and `naima gate add` puts items on it, so nobody edits naima.json by hand. " +
      "A gate with a `due` date (and, optionally, a `version`) is a milestone: `naima gates` and `naima queue` say the days left, and a check warns once it is overdue. " +
      "An item whose type carries the `group` trait — an epic — stands on a gate for the items it groups.",
    options: [
      {
        name: "gates",
        says:
          `\`plugins.gates.options.gates\` in \`${DEFAULT_DATA}/${DATA_FILE}\`, written by \`naima gate new\`: gate name → { "title", "says", "holdsOn", "due", "version" }. due (YYYY-MM-DD) makes the gate a milestone; version is what it ships as. holdsOn "code" (the default) waits for code, not proof: a fixed item that owes only its proving gesture, and the gestures themselves, are owed but do not block. holdsOn "proof": every open item on the gate blocks it.`,
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
    checks: [gatedProofIsGated, overdue],
    commands: [gatesCommand, gateCommand, queue],
    summary: [status],
  }
}
