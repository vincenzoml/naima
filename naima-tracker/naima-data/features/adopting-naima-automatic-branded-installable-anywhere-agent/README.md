# Adopting Naima: automatic, branded, installable anywhere, and an agent skill

The owner's requirements, 2026-09-29, in the order he gave them:

> "why switch on; this repo must be automatic not require decisions"
>
> "the configuration should live in the actual repo of the tool that naima is
> being used within, whereas naima itself could be anywhere on the hard drive"
>
> "we want every person using it to 'just add naima' so repos must carry
> 'naima' as our brand"
>
> "Could naima also be just a *skill* that an agent uses and then it will say
> clone the repo"

A first cut was started before this definition existed and stopped by the
owner (owner rule 3). It is parked, unmerged, on branch
`wip/automatic-config-stopped`: reference only.

## Behaviour

1. **Automatic, not configured.** Every first-party plugin is always loaded.
   Every default is inferred from the repository (beta markers scan the files
   git tracks; the docs check covers every tracked markdown file). There is no
   list of plugins to enable. Configuration holds only facts the tool cannot
   infer: the project's gates, the Naima version pin, extra third-party
   plugins (adding, never switching on). A project with no configuration at
   all beyond the pin works.
2. **One branded directory in the host.** A project using Naima carries a
   single top-level `naima/` directory: `naima/config.json` (the pin, and the
   facts above when there are any) and the items (`naima/bugs/`,
   `naima/todos/`, …). Nothing else of Naima's is written into the host: no
   code, no `node_modules`, no cache. Root detection walks up from the working
   directory to the first directory containing `naima/config.json`. Naima's
   own repository uses exactly this layout (its `tracker/` and
   `naima.config.json` move into `naima/` with `git mv`).
3. **The tool lives anywhere.** Naima is installed once, wherever: `npx naima`
   (no install), a global install, or a clone plus `npm link`. `dist/` builds
   automatically so a clone works. Caches (stable extractions) go in the
   user's cache directory, never in the host.
4. **The host pins its Naima.** `naima/config.json` records the Naima version
   that manages the project (a semver range). A `naima` outside the range
   refuses to act and says, in one line, which version to use. Naima's own
   bootstrap policy (the development version is managed by the previous
   stable) is this same mechanism, not a special case.
5. **"Just add naima."** `npx naima init` in any git repository: creates
   `naima/` with the pin, ~~adds one "Tracked with Naima" line to the README
   (never twice; never creates a README),~~ prints the one next command. No
   question asked. **Reversed 2026-09-30** (see below): `init` touches no
   file outside `naima/`.
6. **An agent skill.** Naima ships a skill (`skills/naima/SKILL.md`, in the
   format agent tools load) that teaches an agent to work in a Naima project:
   the flows, the rules, the commands. When the project has no `naima/`, the
   skill runs `npx naima init`; when `naima` is not available, it tells the
   agent how to get it (npx, or clone the repository and link it). The skill
   is a thin pointer to `docs/flows/` and the reference, never a second copy
   of them.

## Reversal, 2026-09-30

The owner, on the README line of behaviour 5:

> "modifying user files seems extreme"

So the README clause is dropped: `naima init` never touches any file outside
`naima/`, and the brand is carried only by the top-level `naima/` directory.
The struck text above is kept as the record of what was asked first.

## Boundaries

- Not published to npm in this change: the repository is private, and
  publishing is part of the first public release (a todo under
  `first-public`). The package is prepared under the name `naima`, free on npm
  as of 2026-09-29.
- No migration code for other projects: none exist yet.

## Documentation (owner rule 2)

`docs/`: "Using Naima in your project" (install, `init`, the `naima/` layout,
the pin, ~~the badge line~~ — reversed 2026-09-30), "The Naima skill", and the automatic principle in
`docs/config.md`; `docs/reference.md` regenerated.

## Done when

- An end-to-end test creates a temporary git repository outside Naima, runs
  the CLI from Naima's location (`init`, `new`, `check`), and asserts the
  only addition is `naima/` ~~and the README line~~ (reversed 2026-09-30).
- A test shows a `naima` outside the pin refusing with its one-line message.
- Naima's own repo runs on the new layout; a new stable (v0.2.0) is tagged and
  pinned; `npm run verify` passes with both the stable and the working tree.
- The skill file exists, loads, and its links resolve (the docs check).
