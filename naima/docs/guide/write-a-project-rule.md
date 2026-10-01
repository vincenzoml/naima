# Write a project rule

A project's own rules — how an agent works here (quiet, simple, fast modes),
how it reports, what it asks before doing — are items of the project's
tracker, in `naima-tracker/naima-data/rules/`. Every project carries its own,
and Naima shows them to whoever starts work there. The rules every project
holds to are on [the rules page](rules.md); this page is for the ones only
your project has.

## One rule, one item

```sh
naima new rules "Ask before deleting" --set audience=agents --set strength=must
```

Then write its page, `rules/ask-before-deleting/README.md`: the rule, said so
it can be followed without asking, and why it exists.

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

## Retiring a rule

A rule starts `active`. One no longer in force is `retired`
(`naima set <rule> status=retired`), and its page says what replaced it: it
stays as history and is shown nowhere. A rule is not work, so no board of
open work lists it.

## What `naima check` holds

It fails on an active rule with no text (an empty page, or the template's
own), with no audience or one it does not know, or whose `enforcedBy` names
no check or gate. Every field and the check: [reference](../reference/reference.md#rules).

How agents read them: [read the project's rules](../agents/read-the-project-rules.md).
