# Architecture

## Layout

The repository's root holds the runtime folder, `naima/`, and what only
developing Naima needs: a project's `naima-tracker/naima/` is exactly the
contents of `naima/`.

```
naima/src/
  core/            the core: no item type, gate, verifier or workflow is named here
    types.ts       the contract (every interface a plugin sees)
    contract.ts    the contract's version, which every manifest says it is written for
    api.ts         the plugin API: what a plugin may call, and receives from its factory
    internal.ts    the API and what only the entry point, the loader and the tests use
    points.ts      the core's own extension points: types, fields, relations, dirs, checks, commands, views, summary, rank, migrations
    manifest.ts    what a manifest contributes to a point, whichever way it says so
    markdown.ts    the markdown a point's documentation is written with
    rendered.ts    what a view or summary section renders: data, read as text, JSON or markdown
    item.ts        an item on disk: create, move, save
    repo.ts        reading the tracker; ids, reference resolution, inverse links
    fields.ts      field validation and parsing
    registry.ts    merging plugin manifests: qualified ids, short names, renames; a stored name declared twice is an error
    vocabulary.ts  the item vocabulary: types with their extensions, fields by name or trait, relations, directories
    names.ts       how a contribution is called where a person reads it
    check.ts       the core invariants, and running every plugin's
    lifecycle.ts   questions answered from type declarations: open, proves, urgency
    errors.ts      how Naima fails: NaimaError, message(e), the exit codes
    collections.ts small shared helpers: groupBy, the frozen collections of the registry
    git.ts         the one git wrapper (runGit, gitOrNull, mustGit); reading across every branch; the project's files
    files.ts       the one walker (regular files only, links never followed); writeFileAtomic
    layout.ts      naima-tracker/ and its names; finding the data directory
    config.ts      naima.json: the formats, the lock, the plugins table
    plugins.ts     which plugins a project loads, from pinned sources; the contract check; the API each factory is handed
    format.ts      the data formats, the core's and each plugin's; migrations; the one-format check
    migrations.ts  the core's own migrations
    project.ts     opening a project: naima.json, the plugins, their formats, the registry, the context
    entry.ts       the commands the entry point answers before any plugin loads
    excludes.ts    the host tool configurations init prints, or writes, an exclusion for
    program.ts     the program directory: the copy through the per-user cache, alignment, update, carry
    base.ts        the core's own contributions: generic fields, relations, commands
    cli.ts         dispatch, and the commands that move the program
  plugins/<name>/  one directory per first-party plugin:
                   trackers, coordination, triage, gates, beta-markers, verifier, docs, rules
  builtins.ts      every first-party plugin, in load order } the composition root:
  cli.ts           the program's entry point             } the only modules that see both
  launcher.ts      runs the program under Deno's permissions (install.md)
```

```
naima/                    the runtime: what a project's program directory is a copy of
  naima.ts                the launcher's executable: deno run -A naima.ts <command>
  src/                    the program, above; no test
  skills/naima/           the agent skill, and the flow commands in commands/flow/
  docs/                   the documentation for people (guide/) and agents (agents/), and the reference
  docs/reference/reference.md  generated from the manifests by naima docs; never edited by hand
  README.md LICENSE NOTICE
test/                     every test, mirroring naima/src/, and the test helper core/testing.ts
develop/                  the pages for people changing Naima's code: this one, bootstrap, documentation
deno.json                 the tasks: naima, dev, typecheck, lint, fmt, test, docs, verify, coverage
scripts/coverage.ts       coverage of the whole test run, the launched copies of the program counted as the files they copy
site/                     the project site
.claude/commands/         a link to naima/skills/naima/commands/, for this repository's own agents
.github/workflows/        CI: verify on Deno, the tests on Node and Bun, on Linux and macOS; the installers on three systems
```

What ships is only what runs: the contents of `naima/`, and nothing else.
`test/dist.test.ts` holds the dist to that: no test, no development file, no
tracker item, and every import and every relative link of what ships
resolving inside it. A developer page is outside `naima/`, so a page that
ships links it by its URL on GitHub.

## The tracker on disk

Everything Naima writes into a project is under one top-level folder,
`naima-tracker/`, and the items are in its `naima-data/`
([the format](../naima/docs/reference/format.md)):

```
naima-tracker/naima-data/
  naima.json                    the format, the lock, and the facts that cannot be inferred
  <type>/<slug>/README.md       prose
  <type>/<slug>/meta.json       fields: id, title, status, links, and whatever plugins declare
  <type>/<slug>/attachments/    evidence
  claims/<uuid>.json            coordination: one file per branch that claims work
  passes/<date>-<uuid>.md       coordination: one file per session note
```

The directory name is the slug and may change; the uuid in `meta.json` is
permanent and is what links hold. Only one direction of a link is stored; the
inverse is derived when read. Unknown fields are preserved and not checked.

## Derived, never stored

No board, queue, gate status or claim table is ever written. Each is computed
from the items when asked, so no stored copy can go stale. The same holds for
state that belongs to no branch: claims and session notes are written as one
file per session on that session's own branch, and `readAcrossBranches`
recombines them from every local branch: every unmerged one, every worktree's
head, and the trunk. A branch a worktree stands on is read from that
worktree's disk, so uncommitted records count, in every worktree; any other
from its ref. Remote-tracking refs are not read.

## The dependency rule

- The core imports only the `node:` built-ins that Deno, Node and Bun all
  provide, and itself. There are no dependencies.
- A plugin imports only `core/api.ts` — or nothing, using the API its
  factory is handed — and its own files; never `core/internal.ts`. Its tests may also
  import `core/testing.ts`. Plugins never import each other: what one needs
  from another travels through the registry: a field, a relation, a status
  that `proves`, a contribution to an extension point another declares.
- `builtins.ts` and `cli.ts` compose the two.

- The core names no plugin's type, field, relation or plugin in its code: it
  works with any set of plugins.

`test/arch.test.ts` enforces the rule on every test run, on every way one
module reaches another — static, side-effect and dynamic imports, re-exports,
`require` — for the first-party plugins and for a fork's own under `plugins/`.
The one computed import allowed is the core loading a plugin a project's
`plugins` table names (`core/plugins.ts`).

## Checks

`naima check` runs the core invariants (readable items, unique uuids, known
statuses, well-typed fields, resolvable links, no stray directories, unlinked
duplicate titles as a note) and every plugin's checks; the full list is in the
[reference](../naima/docs/reference/reference.md). A problem fails the
run; a note never does. A check that throws is reported as a problem, not a
crash.

## Git discipline

The coordination plugin writes files and never stages or commits them. The
flows that go with it — one worktree per piece of work, a worktree writes only
its own branch, every merge to the trunk is `--ff-only` — are in
[flows](../naima/docs/agents/README.md).
