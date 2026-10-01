# Documentation

| Page | What it holds |
|---|---|
| [Purpose, requirements and principles](purpose.md) | **read first**: why Naima exists, whom it serves, its requirements and what holds each, its design principles, its non-goals |
| [Concepts](concepts.md) | items, links, fixed / resolved / closed, derived state, cross-branch coordination |
| [Installing and updating](install.md) | Deno, bootstrapping a project, the lock and alignment, `naima update`, the permissions and what they do not protect, forks, how the program is carried |
| [Using Naima in your project](using-naima.md) | `naima init`, the `naima-tracker/` folder, the lock, migration, moving things |
| [The format](format.md) | the open specification of every file, field and invariant: the compatibility boundary between forks |
| [The Naima skill](skill.md) | the agent skill: what it teaches, how an agent loads it |
| [Configuration](config.md) | the automatic principle, gates, third-party plugins |
| [Reference](reference.md) | **generated**: every command with its options and examples, every item type and status, field, link relation, check, gate and how it decides, view, verifier, and every plugin with its options |
| [Plugin contract](plugin-contract.md) | writing a plugin: the manifest, the context, the verifier contract, testing |
| [Architecture](architecture.md) | the source layout, the tracker on disk, the dependency rule |
| [The documentation rule](documentation.md) | every feature documented as part of its implementation, and how `naima check` holds it |
| [Naima tracking itself](bootstrap.md) | how this repository's own tracker is managed by a locked clone of Naima, never by the working tree |
| [Flows](flows/README.md) | procedures for people and AI agents: coordinator and workers, worktrees, merges, reporting |

The reference is generated from the plugin manifests by `naima docs`, so it
cannot drift from the code: in this repository `deno task docs` rewrites it
and `deno task verify` fails when it is out of date or when anything loaded is
undocumented.
