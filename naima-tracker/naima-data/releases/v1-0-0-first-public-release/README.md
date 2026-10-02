# v1.0.0 — first public release

Naima 1.0 — the first public release.

Naima keeps a project's work as plain files in the project's own git repository, so people and AI agents plan, prove and coordinate in one place.

- Install with one line, on macOS, Linux and Windows, from the root of your repository (https://vincenzoml.github.io/naima/); or ask your agent to install it. Only Deno is needed, and the installer gets it if it is missing.
- Bugs, todos, features, tests and properties as files, with views derived when read: board, list, summary, timeline, coverage, and `naima ui`.
- Fixed, resolved and closed kept apart: an item closes only with a passed proof, and gates hold only when what is on them is done.
- Coordination through git: worktrees, claims and session notes, so several agents work in parallel without losing track.
- Project rules as data, read by every agent at the start of work; a pre-commit hook enforces the ones it can.
- Model checking as evidence: an mCRL2 verifier plugin runs properties and attaches each run; as an example in Naima's code, a small mCRL2 model of Naima's claim protocol (two branches, two items) is checked with it.
- Per-commit metrics, epics, gates, decisions, a release runbook, and packs for non-software work (data analyses, papers).
- Naima tracks its own development with itself.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on main

Stage: pre-release checks
Gate first-public holds (naima gates). Clean clone of main at 37ecc0c: deno task verify exit 0 (naima check: all invariants hold), node --test exit 0, bun test 381 pass 0 fail. A first clean run at 2ca504b failed (Bun timeout on the live mCRL2 case-study test; one unformatted file); fixed in fc2df2e, then rerun green.

### 2026-10-01 — Vincenzo Ciancia, on main

Stage: private draft
GitHub draft release v1.0.0 'Naima 1.0', target 022b90a (no code change since the tested 37ecc0c; tracker data only), notes = the changelog. Visible only to the repository's owner.

### 2026-10-01 — Vincenzo Ciancia, on main

Stage: test the artifact
The installer as published on the site (byte-identical to site/install.sh) run in a fresh git init repository: exit 0, all invariants hold, lock at 022b90a. In that install: naima new, list and check worked. Windows: install.ps1 proven on fmt-4000 earlier today (tests/install-ps1-installs-naima-windows-machine-fresh).

### 2026-10-01 — Vincenzo Ciancia, on main

Stage: publish
GitHub release v1.0.0 'Naima 1.0' published 2026-10-01T21:30:38Z as latest; tag v1.0.0 at 022b90a. The owner's go is decisions/release-naima-1-0-public.

### 2026-10-01 — Vincenzo Ciancia, on main

Stage: post-release checks
The public one-liner (curl https://vincenzoml.github.io/naima/install.sh | sh) in a fresh git init repository: exit 0, all invariants hold, locked to 022b90a = v1.0.0. Installing the tag itself (NAIMA_REF=v1.0.0) is refused by init (a tag is not the source's main); the installer documents NAIMA_REF as a branch, so this is filed for Release 1.1, not a regression.

### 2026-10-01 — Vincenzo Ciancia, on main

Stage: announce
The release notes on the GitHub release page are the changelog above; they state only what exists and was tested. naima announce lists 0 features as announceable (none is checked by a person end to end yet); no further announcement is made.
