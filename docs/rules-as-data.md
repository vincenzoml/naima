# Rules as data

A project's own rules — how an agent works here (quiet, simple, fast modes),
how it reports, what it asks before doing — are items of the project's
tracker, in `naima-tracker/naima-data/rules/`. Every project carries its own,
and Naima shows them to whoever starts work there. The `rules` plugin holds
them ([reference](reference.md)).

## Writing a rule

One rule, one item. Its page is the rule and the reason it exists; three
fields say whom it binds and how much:

```sh
naima new rules "Ask before deleting" --set audience=agents --set strength=must
```

Then write the page, `rules/ask-before-deleting/README.md`, so it can be
followed without asking:

```markdown
# Ask before deleting

Ask first before deleting data or items, force-pushing, or discarding
someone's uncommitted work.

Why: what cannot be undone is the owner's decision.
```

| Field | Values |
|---|---|
| `audience` | `agents`, `people`, `everyone` |
| `strength` | `must` (always), `should` (unless there is a reason, said where the work is recorded) |
| `enforcedBy` | optional: the check or gate that holds the rule, by name |

A rule starts `active`. One no longer in force is `retired`
(`naima set <rule> status=retired`), and its page says what replaced it: it
stays as history and is shown nowhere. A rule is not work, so no board of
open work lists it.

`naima check` fails on an active rule with no text (an empty page, or the
template's own), with no audience or one it does not know, or whose
`enforcedBy` names no check or gate.

## Reading the rules

```sh
naima rules --audience agents     # what an agent reads at the start of work
naima rules --audience people
naima rules --json                # every active rule, as data
```

`must` comes before `should`; `--audience` keeps the rules for that audience
and those for everyone. `naima guide`, run inside a project, prints the
project's rules for agents before it points at the documentation, so an agent
that starts from the guide reads them first. The [Naima skill](skill.md)
tells an agent to read them at the start of every session.
