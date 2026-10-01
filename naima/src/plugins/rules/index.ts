// A project's own rules, as tracker data: one item per rule, its README the
// rule and its reason. `naima rules` lists the active ones, and `naima guide`
// prints those for agents first, so an agent starting work in any project
// reads that project's rules before anything else.

import {
  bool,
  type Check,
  type Command,
  type Context,
  CONTRACT,
  type FieldDef,
  fieldValue,
  type Finding,
  type GuideSection,
  type Item,
  label,
  parse,
  type Plugin,
  readReadme,
  type Rendered,
  rendered,
  str,
  type TypeDef,
  usageError,
} from "../../core/api.ts"

export const AUDIENCES = ["agents", "people", "everyone"] as const
export type Audience = (typeof AUDIENCES)[number]

const PLACEHOLDER = "The rule, said so that it can be followed without asking.\n\nWhy: the reason it exists."
const template = (title: string): string => `# ${title}\n\n${PLACEHOLDER}\n`

const rulesType: TypeDef = {
  id: "rules",
  dir: "rules",
  title: "Rules",
  says:
    "a rule of this project, for agents, people or both: its page is the rule and its reason; a rule is not work, so neither status is open and no board of open work lists it",
  statuses: {
    active: { category: "done", says: "in force: `naima rules` and `naima guide` show it" },
    retired: { category: "done", says: "no longer in force; the page says what replaced it, if anything" },
  },
  initialStatus: "active",
  template,
}

const AUDIENCE: FieldDef = {
  name: "audience",
  kind: "enum",
  says: "who the rule binds",
  values: { agents: "an agent working in the project", people: "a person working in the project", everyone: "agents and people alike" },
  appliesTo: ["rules"],
}
const STRENGTH: FieldDef = {
  name: "strength",
  kind: "enum",
  says: "how binding the rule is",
  values: { must: "always; breaking it is a defect", should: "unless there is a reason, said where the work is recorded" },
  appliesTo: ["rules"],
}
const ENFORCED_BY: FieldDef = {
  name: "enforcedBy",
  kind: "string",
  says: "the check or gate that enforces the rule, when one does; unset, the rule is kept by whoever reads it",
  appliesTo: ["rules"],
}

/** How this plugin reads its own fields: as plain strings. */
const read = (f: FieldDef) => ({ name: f.name, kind: "string" }) as const

/** One rule, as `naima rules --json` prints it. */
export interface Rule {
  item: string
  title: string
  audience: string | null
  strength: string | null
  enforcedBy: string | null
  text: string
}

/** A rule's text: its page without the title heading. */
export const ruleText = (item: Item): string => readReadme(item).replace(/^#[^\n]*\n/, "").trim()

const asRule = (item: Item): Rule => ({
  item: label(item),
  title: String(item.meta.title ?? ""),
  audience: fieldValue(item, read(AUDIENCE)) ?? null,
  strength: fieldValue(item, read(STRENGTH)) ?? null,
  enforcedBy: fieldValue(item, read(ENFORCED_BY)) ?? null,
  text: ruleText(item),
})

const active = (ctx: Context): Item[] => ctx.repo.items.filter((i) => i.type === rulesType.id && i.meta.status === "active")

/** The active rules for `audience` — those for it and those for everyone; every one without an audience — `must` before `should`. */
export function activeRules(ctx: Context, audience?: Audience): Rule[] {
  const rank = (r: Rule) => (r.strength === "must" ? 0 : r.strength === "should" ? 1 : 2)
  return active(ctx)
    .map(asRule)
    .filter((r) => !audience || r.audience === audience || r.audience === "everyone")
    .sort((a, b) => rank(a) - rank(b))
}

function rulesRendered(rules: Rule[], heading: string): Rendered<Rule[]> {
  return rendered(rules, (rs) =>
    rs.length
      ? [
        heading,
        ...rs.flatMap((r) => [
          "",
          `${(r.strength ?? "?").toUpperCase()} · ${r.audience ?? "no audience"} · ${r.title} (${r.item}${
            r.enforcedBy ? `, enforced by ${r.enforcedBy}` : ""
          })`,
          ...r.text.split("\n").map((l) => (l ? `    ${l}` : "")),
        ]),
      ]
      : [])
}

const command: Command = {
  name: "rules",
  says: "print the project's active rules, must before should, each with its text and reason: what an agent reads at the start of work",
  enforces: "nothing: it only prints",
  usage: "rules [--audience <agents|people|everyone>] [--json]",
  options: [
    { name: "--audience", says: "only the rules for that audience, and those for everyone" },
    { name: "--json", says: "print the rules as JSON: item, title, audience, strength, enforcedBy, text" },
  ],
  examples: ["rules", "rules --audience agents", "rules --audience people --json"],
  run(args, ctx) {
    const p = parse(args, { audience: { type: "string" }, json: { type: "boolean" } })
    const audience = str(p, "audience")
    if (p.positionals.length || (audience !== undefined && !AUDIENCES.includes(audience as Audience))) throw usageError(this)
    const rules = activeRules(ctx, audience as Audience | undefined)
    if (bool(p, "json")) {
      ctx.out(JSON.stringify(rules, null, 2))
      return 0
    }
    const lines = rulesRendered(rules, `The project's rules${audience ? ` for ${audience}` : ""} (naima rules):`).text()
    for (const l of lines.length ? lines : [`no active rules${audience ? ` for ${audience}` : ""} — naima new rules "<the rule>"`]) ctx.out(l)
    return 0
  },
}

const guide: GuideSection = {
  name: "rules",
  says: "the project's active rules for agents, read before anything else",
  render: (ctx) => rulesRendered(activeRules(ctx, "agents"), "Read first — the project's rules for agents (naima rules --audience agents):"),
}

const check: Check = {
  name: "rules",
  says: "every active rule has its text and a valid audience, and names as enforcedBy only a check or gate that exists",
  run(ctx) {
    const known = new Set(["checks", "gates"].flatMap((p) => ctx.registry.contributions(p).flatMap((c) => [c.name, c.id])))
    return active(ctx).flatMap((item): Finding[] => {
      const out: Finding[] = []
      const text = ruleText(item)
      if (!text || text === PLACEHOLDER) {
        out.push({ level: "problem", item, message: `${label(item)}: an active rule with no text — write the rule and its reason on its page` })
      }
      const audience = item.meta[AUDIENCE.name]
      if (!AUDIENCES.includes(audience as Audience)) {
        out.push({
          level: "problem",
          item,
          message: `${label(item)}: an active rule ${audience === undefined ? "with no audience" : `for ${JSON.stringify(audience)}`} — naima set ${
            label(item)
          } audience=${AUDIENCES.join("|")}`,
        })
      }
      const by = fieldValue(item, read(ENFORCED_BY))
      if (by && !known.has(by)) out.push({ level: "problem", item, message: `${label(item)}: enforcedBy names "${by}", which is no check or gate` })
      return out
    })
  },
}

export default function rules(): Plugin {
  return {
    name: "rules",
    contract: CONTRACT,
    says: "the project's own rules, kept as items: shown to agents first by naima guide, listed by naima rules",
    about:
      "A project's rules — how an agent works here (quiet, simple, fast), how it reports, what it asks before doing — are tracker data, one `rules` item each, so every project carries its own. " +
      "A rule's page is the rule and its reason; `audience` says whom it binds (`agents`, `people`, `everyone`), `strength` how much (`must`, `should`), and `enforcedBy`, when set, the check or gate that holds it. " +
      "An active rule is shown; a retired one is kept as history. `naima rules --audience agents` is what an agent reads at the start of work, and `naima guide` prints it first. ",
    types: [rulesType],
    fields: [AUDIENCE, STRENGTH, ENFORCED_BY],
    commands: [command],
    checks: [check],
    guide: [guide],
  }
}
