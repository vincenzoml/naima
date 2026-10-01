# Project rules as tracker data: a rules type, naima rules, and rules first in naima guide

The owner's decision: a project's own rules — an owner's working modes for
agents (quiet, simple, fast), reporting rules, what to ask before doing — are
tracker data in the project's `naima-data/`, so every host project has its
own and Naima shows them to agents and people.

## Behaviour

- A first-party plugin, `rules`, contributes the item type `rules`: one rule
  per item. Its README is the rule text with its reason. Fields: `audience`
  (`agents`, `people`, `everyone`), `strength` (`must`, `should`),
  `enforcedBy` (optional: the check or gate that enforces it). Statuses:
  `active` (initial) and `retired`.
- `naima rules [--audience <a>] [--json]` lists the active rules, `must`
  before `should`, each with its full text: the form an agent reads at the
  start of a session. `--audience agents` keeps the rules for agents and for
  everyone.
- `naima guide`, run inside a project, prints the project's active rules for
  agents first, then the documentation pages. The core declares a `guide`
  extension point for this, so the core never names the rules plugin.
- The Naima skill tells an agent to read `naima rules --audience agents` at
  the start of work.
- A check, `rules`: every active rule has non-empty text and a valid audience.

## Boundaries

- Data only: no rule is executed; `enforcedBy` names, it does not run.
- Naima's own tracker runs the locked commit, which has no `rules` type: the
  Modes section of AGENTS.md is moved into rules by the seed attached here
  (`attachments/seed-rules.sh`), run once the lock moves past this change.

## Documentation

`docs/guide/write-a-project-rule.md` (how a person writes a rule), `docs/agents/read-the-project-rules.md` (how an agent reads
them), the plugin's manifest, `docs/reference/reference.md` regenerated.
