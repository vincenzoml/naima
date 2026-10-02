// Resources: what one branch at a time may touch — the published site, the
// trunk of another repository, the release tags. An item claim may be shared;
// a resource claim is exclusive. The resources are data, declared in the
// plugin's `resources` option; a branch holds one by naming it in its claim
// file, beside its items, so a resource claim is recombined from every branch
// exactly as an item claim is.

/** A declared resource: what it is, and the role that holds it, when one does. */
export interface Resource {
  name: string
  says: string
  role?: string
}

const NAME = /^[a-z][a-z0-9-]*$/

/** The resources `options.resources` declares: name → { says, role? }. */
export function readResources(options: Record<string, unknown>): Map<string, Resource> {
  const raw = options["resources"] ?? {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('coordination: option resources must be an object: resource name → { "says": "<what it is>", "role": "<who holds it>" }')
  }
  const out = new Map<string, Resource>()
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!NAME.test(name)) throw new Error(`coordination: resource "${name}" must be named with lowercase letters, digits and dashes`)
    const r = (v && typeof v === "object" ? v : {}) as Partial<Resource>
    if (typeof r.says !== "string" || !r.says.trim()) throw new Error(`coordination: resource "${name}" does not say what it is ("says")`)
    if (r.role !== undefined && (typeof r.role !== "string" || !NAME.test(r.role))) {
      throw new Error(`coordination: resource "${name}" names a role that is not lowercase letters, digits and dashes`)
    }
    out.set(name, { name, says: r.says, ...(r.role ? { role: r.role } : {}) })
  }
  return out
}

/** One branch holding a resource, as `naima claims --resources --json` prints it. */
export interface Holder {
  branch: string
  /** The claim's id: its file's name without `.json`. */
  claim: string
  claimedAt: string
  local: boolean
  note?: string
  /** The branch is gone from git: `naima prune` lists it. */
  stale: boolean
}

/** Every declared resource with its holders — none when free — then any held resource no longer declared. */
export interface ResourcesData {
  resources: (Resource & { declared: boolean; holders: Holder[] })[]
}

interface Held {
  branch: string
  file: string
  claimedAt: string
  local: boolean
  note?: string
  resources?: string[]
}

export function resourcesData(declared: Map<string, Resource>, claims: Held[], alive: Set<string>): ResourcesData {
  const holders = (name: string): Holder[] =>
    claims
      .filter((c) => c.resources?.includes(name))
      .map((c) => ({
        branch: c.branch,
        claim: c.file.replace(/\.json$/, ""),
        claimedAt: c.claimedAt,
        local: c.local,
        ...(c.note ? { note: c.note } : {}),
        stale: !alive.has(c.branch),
      }))
      .sort((a, b) => (a.branch < b.branch ? -1 : 1))
  const undeclared = [...new Set(claims.flatMap((c) => c.resources ?? []))].filter((n) => !declared.has(n)).sort()
  return {
    resources: [
      ...[...declared.values()].map((r) => ({ ...r, declared: true, holders: holders(r.name) })),
      ...undeclared.map((name) => ({ name, says: "not declared", declared: false, holders: holders(name) })),
    ],
  }
}

/** Why `branch` cannot take `name`: the holders that are not it, each said in full. Empty when it may. */
export function refusal(name: string, branch: string, data: ResourcesData): string | null {
  const others = data.resources.find((r) => r.name === name)?.holders.filter((h) => h.branch !== branch) ?? []
  if (!others.length) return null
  const who = others.map((h) =>
    h.stale
      ? `${h.branch}, a branch git no longer has: naima prune lists its claim ${h.claim}, naima prune --write on the branch carrying it removes it`
      : `${h.branch} (claim ${h.claim}, since ${h.claimedAt || "an unknown day"}${h.note ? `: ${h.note}` : ""})`
  )
  return `${name} is held by ${who.join("; ")} — a resource has one holder: wait for its release, or file the change as an item for the holder`
}
