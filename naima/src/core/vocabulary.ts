// The item vocabulary a project ends up with: every type, field, relation
// and directory the plugins contribute, their cross-references resolved, and
// every extension applied. Data only: a type is extended by adding to it —
// statuses, traits, transitions — never by deriving another type from it, and
// a field applies to types by name or by trait.

import type { Contribution, Extension, FieldDef, RelationDef, StatusDef, TypeDef } from "./types.ts"

export interface Vocabulary {
  types: Map<string, TypeDef>
  fields: Map<string, FieldDef>
  relations: Map<string, RelationDef>
  dirs: Set<string>
}

/** How the registry finds what a contribution names: the contributions of a point, one by reference, a plugin's own renamed name. */
export interface Lookup {
  of<T>(point: string): Contribution<T>[]
  find<T>(point: string, ref: string): Contribution<T> | undefined
  ownName(point: string, plugin: string, declared: string): string
  /** Whether some loaded plugin declares the point. */
  has(point: string): boolean
}

const union = (a: readonly string[] | undefined, b: readonly string[] | undefined): string[] | undefined =>
  a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined

/** A status's flags, its `proves` and `refutes` keys included. */
export const flagsOf = (s: StatusDef): string[] => [...new Set([...(s.flags ?? []), ...(s.proves ? ["proves"] : []), ...(s.refutes ? ["refutes"] : [])])]

/** Why a type's statuses or transitions are not its own, or null. */
function typeRefusal(t: TypeDef): string | null {
  if (!Object.hasOwn(t.statuses, t.initialStatus)) return `type "${t.id}": initial status "${t.initialStatus}" is not one of its statuses`
  for (const [name, s] of Object.entries(t.statuses)) {
    const flags = flagsOf(s)
    if (flags.includes("proves") && flags.includes("refutes")) return `type "${t.id}": status "${name}" both proves and refutes`
  }
  for (const [from, to] of Object.entries(t.transitions ?? {})) {
    for (const s of [from, ...to]) if (!Object.hasOwn(t.statuses, s)) return `type "${t.id}": transitions name status "${s}", which it does not have`
  }
  return null
}

/** `t` with an extension's additions; an existing status keeps its category, or the extension is refused. */
function extendType(t: TypeDef, e: Extension, by: string): TypeDef {
  const statuses: Record<string, StatusDef> = { ...t.statuses }
  for (const [name, s] of Object.entries(e.statuses ?? {})) {
    const before = Object.hasOwn(statuses, name) ? statuses[name] : undefined
    if (before && before.category !== s.category) {
      throw new Error(`${by} extends type "${t.id}": status "${name}" is ${before.category}, and an extension may not make it ${s.category}`)
    }
    const flags = before ? union(flagsOf(before), flagsOf(s)) : s.flags
    statuses[name] = { ...before, ...s, ...(flags?.length ? { flags } : {}) }
  }
  const transitions: Record<string, string[]> = { ...t.transitions }
  for (const [from, to] of Object.entries(e.transitions ?? {})) transitions[from] = union(transitions[from], to) ?? []
  const traits = union(t.traits, e.traits)
  return {
    ...t,
    statuses,
    ...(traits ? { traits } : {}),
    ...(Object.keys(transitions).length ? { transitions } : {}),
  }
}

/**
 * The vocabulary the contributions make: types with every extension applied,
 * fields with their types named — by name or by trait — and their values
 * taken where they say, relations with their inverses as renamed, and every
 * directory claimed once.
 */
export function vocabulary(look: Lookup): Vocabulary {
  const dirs = new Map<string, string>()
  const claim = (dir: string, by: string): void => {
    const previous = dirs.get(dir)
    if (previous !== undefined) throw new Error(`directory "${dir}" is claimed by both ${previous} and ${by}`)
    dirs.set(dir, by)
  }
  const types = new Map<string, TypeDef>()
  for (const { value: t, id } of look.of<TypeDef>("types")) {
    types.set(t.id, t)
    claim(t.dir, `type ${id}`)
  }
  for (const { name, id } of look.of<string>("dirs")) claim(name, id)

  /** A type a plugin names: its own by declared name, else a qualified id or a short name. */
  const typeRef = (plugin: string, ref: string): string | undefined => {
    const own = look.of<TypeDef>("types").find((c) => c.id === `${plugin}/${ref}`)
    return own ? own.name : look.find<TypeDef>("types", ref)?.name
  }
  const typesNamed = (plugin: string, refs: readonly string[] | undefined, what: string): string[] | undefined =>
    refs?.map((t) => {
      const id = typeRef(plugin, t)
      if (id === undefined) throw new Error(`${what} applies to type "${t}", which no plugin declares`)
      return id
    })

  const extensions = look.of<Extension>("extends")
  for (const { value: e, plugin } of extensions) {
    if (e.type === undefined) continue
    const id = typeRef(plugin, e.type)
    const t = id === undefined ? undefined : types.get(id)
    if (!t) throw new Error(`"${plugin}" extends type "${e.type}", which no plugin declares`)
    types.set(t.id, extendType(t, e, `"${plugin}"`))
  }
  for (const t of types.values()) {
    const why = typeRefusal(t)
    if (why) throw new Error(why)
  }

  /** The types a field applies to: those it names and those carrying a trait it names; undefined for every type. */
  const concrete = (named: string[] | undefined, traits: readonly string[] | undefined): string[] | undefined => {
    if (!named && !traits) return undefined
    const tagged = [...types.values()].filter((t) => t.traits?.some((tr) => traits?.includes(tr))).map((t) => t.id)
    return union(named, tagged) ?? []
  }
  const fields = new Map<string, FieldDef>()
  for (const { value: f, plugin } of look.of<FieldDef>("fields")) {
    const appliesTo = concrete(typesNamed(plugin, f.appliesTo, `field "${f.name}"`), f.traits)
    fields.set(f.name, { ...f, ...(appliesTo ? { appliesTo } : {}) })
  }
  for (const { value: e, plugin } of extensions) {
    if (e.field === undefined) continue
    const name = look.find<FieldDef>("fields", e.field)?.name
    const f = name === undefined ? undefined : fields.get(name)
    if (!f) throw new Error(`"${plugin}" extends field "${e.field}", which no plugin declares`)
    if (e.values && f.kind !== "enum") throw new Error(`"${plugin}" extends field "${f.name}" with values, and it is a ${f.kind}, not an enum`)
    const values = e.values ? { ...f.values, ...e.values } : f.values
    // A field that applies to every type already applies to whatever an extension would add.
    const appliesTo = f.appliesTo && (e.appliesTo || e.traits)
      ? union(f.appliesTo, concrete(typesNamed(plugin, e.appliesTo, `"${plugin}" extending field "${f.name}"`), e.traits))
      : f.appliesTo
    fields.set(f.name, { ...f, ...(values ? { values } : {}), ...(appliesTo ? { appliesTo } : {}) })
  }
  // Values taken from a point: every contribution's name, meaning its title, or what it says.
  for (const f of fields.values()) {
    if (f.valuesFrom === undefined) continue
    if (f.kind !== "enum") throw new Error(`field "${f.name}" takes values from "${f.valuesFrom}", and it is a ${f.kind}, not an enum`)
    if (!look.has(f.valuesFrom)) throw new Error(`field "${f.name}" takes values from "${f.valuesFrom}", which no loaded plugin declares as an extension point`)
    const values = Object.fromEntries(
      look.of<{ title?: unknown; says?: unknown }>(f.valuesFrom).map((c) => [c.name, String(c.value?.title ?? c.value?.says ?? "")]),
    )
    fields.set(f.name, { ...f, values: { ...f.values, ...values } })
  }

  const relations = new Map<string, RelationDef>()
  for (const { value: r, plugin } of look.of<RelationDef>("relations")) {
    const inverse = look.ownName("relations", plugin, r.inverse)
    relations.set(r.name, inverse === r.inverse ? r : { ...r, inverse })
  }
  for (const r of relations.values()) {
    if (!relations.has(r.inverse)) throw new Error(`relation "${r.name}" names inverse "${r.inverse}", which is not declared`)
  }
  return { types, fields, relations, dirs: new Set(dirs.keys()) }
}
