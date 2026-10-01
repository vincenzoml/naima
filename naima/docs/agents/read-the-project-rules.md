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
naima rules --json           # as data: item, title, audience, strength, enforcedBy, text
```

A rule is an [item](../guide/glossary.md#item) of the project's tracker; a person writes it
([write a project rule](../guide/write-a-project-rule.md)). A rule marked
`enforcedBy` is held by that check or [gate](../guide/glossary.md#gate) as well; the others are kept by
whoever reads them.
