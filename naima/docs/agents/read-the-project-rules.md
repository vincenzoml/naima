# Read the project's rules

At the start of work, before anything else:

```sh
naima rules --audience agents
```

It prints the project's own active rules for agents, and those for
everyone, `must` before `should`, each with its text and its reason. Obey
them for the whole session, on top of [the rules](../guide/rules.md) every
project holds to. `naima guide`, run inside the project, prints the same
rules first, before it points at the documentation.

```sh
naima rules                  # every active rule, whatever its audience
naima rules --json           # as data: item, title, audience, strength, enforcedBy, ack, text
```

A rule is an [item](../guide/glossary.md#item) of the project's tracker; a person writes it
([write a project rule](../guide/write-a-project-rule.md)). A rule marked
`enforcedBy` is held by that check or [gate](../guide/glossary.md#gate) as well; the others are kept by
whoever reads them.

## Giving the acknowledgement back

When any active rule sets `ack`, the listing above ends with one more line:

```
Acknowledge: Quiet mode on · Simple mode on · Fast mode on
```

Give that line back, exactly, in your first reply of the session — it is how
the project checks the rules were read, not only printed. A session note
(`naima pass --ack "<line>"`) carries it too, first, and is refused if a
phrase is missing; `naima check` holds a note written after acknowledgement
lines began to carrying one. Whoever reads a reply instead of running it
checks the same way, on any text: `naima rules check-ack <file|->`.
