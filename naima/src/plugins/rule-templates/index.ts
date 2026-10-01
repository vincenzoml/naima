// Ready-made rule templates: lessons that recur across projects, written
// once here instead of relearned by each one. Opt in with
// `plugins.rule-templates: {}` in naima.json; none is enabled by instantiating
// the plugin — a template becomes a project's rule only when `rule-templates
// add` is run for it, and the project can edit or retire what it gets.
//
// A template is plain data (id, title, the rule and its reason, strength),
// never code: `add` creates an ordinary `rules` item from it, for `audience:
// agents`, exactly as if someone had typed it by hand.

import { type Command, CONTRACT, createItem, type Plugin, saveProse, typeOrThrow, usageError } from "../../core/api.ts"

interface Template {
  id: string
  title: string
  strength: "must" | "should"
  /** The rule, then its reason — joined under "Why:" the way a rules item's page reads. */
  rule: string
  why: string
}

export const TEMPLATES: readonly Template[] = [
  {
    id: "one-predicate",
    title: "A computed condition is checked in one place",
    strength: "should",
    rule:
      "When the same condition decides more than one thing (whether to show a control, whether to allow an action), compute it once, by name, and have every caller read that name — never re-derive the same condition a second time nearby.",
    why:
      "two copies of one predicate drift the day only one of them is fixed; the surviving bug is invisible because the code that looks right is the one nobody is reading.",
  },
  {
    id: "no-dead-restore-guard",
    title: "A 'do not restore' comment is removed, or acted on, not left standing",
    strength: "should",
    rule:
      "A comment that tells a future change not to do something (`// do not re-enable this`, `// never restore the old path`) is checked at the time it is written: either the thing it warns against is made impossible in code, or the comment is deleted once the risk has passed. It is never left as the only defence.",
    why:
      "a comment stops nobody who does not read it; the restore it warns against happens again, silently, and the comment is found afterwards, too late to have helped.",
  },
  {
    id: "no-user-state-in-shipped-files",
    title: "User state is kept out of files the project ships",
    strength: "must",
    rule:
      "A file that an update overwrites or reinstalls (a shipped template, a packaged default, a generated asset) never carries a user's own data or settings. User state lives in a file of its own, outside what ships, so an update cannot silently discard it.",
    why: "the next update overwrites the shipped file and the user's data goes with it, usually without anyone noticing until it is asked for.",
  },
  {
    id: "reap-id-keyed-overlays",
    title: "An overlay keyed by an id is reaped when the id's owner is gone",
    strength: "should",
    rule:
      "A cache, overlay or side table keyed by another record's id (a user id, a session id, an item id) is pruned when that record is deleted or expires — on a schedule, or when the record's own deletion runs. It is never left to grow forever on the assumption that the key will be looked up again.",
    why:
      "nothing deletes it on its own; the table that was meant to speed things up becomes the thing that will not fit in memory, and nobody who added a row remembers they own its cleanup too.",
  },
  {
    id: "format-change-discipline",
    title: "A format change is migrated once, not carried in the product forever",
    strength: "should",
    rule:
      "In-product migration code (reading an old format at startup and converting it) is written and kept only for formats present at a released version — checked by `git tag`, never by a feeling that 'some users might still have the old one'. Data left over locally in the old format is migrated once, by a throwaway script, with whatever reads or writes it stopped first and a backup taken; the migration is verified by rescanning afterwards, and the script is then deleted. A file the migration cannot read is set aside whole, untouched, and start-up continues past it rather than trying to repair it in place.",
    why:
      "migration code for a format nothing has produced since the last release is dead weight that still runs on every start-up, and a migration attempted live, on data nobody backed up, turns a format change into a data-loss incident.",
  },
]

const byId = new Map(TEMPLATES.map((t) => [t.id, t]))

const command: Command = {
  name: "rule-templates",
  says: "list the ready-made rule templates this plugin ships, or add one as a project rule (a rules item, audience agents): none is added until asked for",
  usage: "rule-templates | rule-templates add <id>",
  options: [],
  examples: ["rule-templates", "rule-templates add one-predicate"],
  run(args, ctx) {
    const [sub, id, ...extra] = args
    if (sub === undefined) {
      if (id !== undefined) throw usageError(this)
      for (const t of TEMPLATES) ctx.out(`${t.id}  ${t.strength.toUpperCase()}  ${t.title}`)
      if (!TEMPLATES.length) ctx.out("no rule templates")
      return 0
    }
    if (sub !== "add" || id === undefined || extra.length) throw usageError(this)
    const tmpl = byId.get(id)
    if (!tmpl) throw new Error(`rule-templates: no template "${id}" — naima rule-templates lists them`)
    const made = createItem(ctx, typeOrThrow(ctx, "rules"), tmpl.title, { audience: "agents", strength: tmpl.strength })
    saveProse(ctx, made, `# ${tmpl.title}\n\n${tmpl.rule}\n\nWhy: ${tmpl.why}\n`)
    ctx.reload()
    ctx.out(
      `${made.type}/${made.slug}: added from template "${id}" as an active rule — edit or retire it like any other: naima set ${made.type}/${made.slug} status=retired`,
    )
    return 0
  },
}

export default function ruleTemplates(): Plugin {
  return {
    name: "rule-templates",
    contract: CONTRACT,
    says: "ready-made rule templates for lessons that recur across projects: `rule-templates add <id>` writes one as an ordinary rules item",
    about:
      "A handful of lessons repeat in project after project: a predicate computed twice, a dead 'do not restore' comment, user data written into a file the next update overwrites, a cache keyed by an id that nothing ever reaps, and migration code kept forever for a format no release still produces. " +
      "Each is shipped here as a template — an id, a title, the rule and its reason, for `audience: agents` — never as code that does anything on its own. " +
      "`naima rule-templates` lists them; `naima rule-templates add <id>` writes one as an ordinary `rules` item, exactly as if it had been typed by hand, which the project can then edit, retarget at a different audience or strength, or retire. " +
      "None is added by turning this plugin on: opting in only makes the templates available to ask for.",
    types: [],
    // What it reads of the rules plugin: the type it writes templates into, and the fields a rules item carries.
    uses: { fields: ["audience", "strength"] },
    commands: [command],
  }
}
