# Host leakage: the installed program directory holds only what runs Naima

## Owner requirements (definition of done)

- The installed program directory (`naima-tracker/naima/` today) contains
  only what runs Naima: no tests, no fixtures, no CI config, no dev-only
  agent rules (`AGENTS.md`, `CLAUDE.md`, `.claude/`), and none of Naima's own
  tracker items.
- A host project's own tracked material (its tests, features, milestones,
  documentation) lives in its own `naima-data/`, organised by kind — never
  inside the program directory.

## Approach (per DECISIONS.md, decision D-15)

**V4: a runtime-only `dist` branch, built by CI from `main`.**

- CI builds a `dist` branch from every commit on `main`: the runtime file
  set only (`naima.ts`, `src/**/*.ts` minus `src/**/*.test.ts` and
  `src/core/testing.ts`, `docs/**`, `skills/naima/SKILL.md`, `LICENSE`,
  `NOTICE`, `README.md` — 52 files, measured in review-host-leakage.md's
  mitigation section, variant V4). The dist commit carries a
  `Source-Commit: <sha>` trailer pointing at the `main` commit it was built
  from.
- Hosts clone and lock the *dist* branch, not `main`: `naima.json`'s
  `source`/`commit` name the dist repository and a dist commit.
  `naima update` reads `refs/heads/main` of the source today
  (`src/core/program.ts`); it is extended to read `dist`'s own `main` (the
  dist repository's default branch), so no change to the lock's field
  semantics is needed, only to which repository/branch it points at.
- `init` prints host-exclude lines for the config files it finds present
  (`deno.json` `exclude`, tsconfig `exclude`, `.prettierignore`), covering
  the residual leak that even the runtime `.ts` files reach `deno check`,
  `tsc` and `prettier`. It writes them into the host's own config files only
  behind an explicit opt-in flag (`naima init --write-excludes` or similar);
  printing them is the default, unprompted behaviour, consistent with
  "`init` ... touches no file outside `naima-tracker/`" — writing outside it
  needs the flag.
- `naima guide` stops listing `AGENTS.md` (it is Naima's own development
  rule file, not a host-facing doc); today it prints it under `rules` and
  every trimmed variant tested left that reference dangling.
- `.claude/commands/flow/*.md` (Naima's own slash commands) move out of
  `.claude/` if they are meant for hosts to adopt, since an agent harness may
  auto-load anything under `.claude/` — or are dropped from the shipped set
  entirely if they are development-only, per whichever the owner decides
  when this feature is implemented (not yet decided in DECISIONS.md).

## Boundaries

- Development on Naima itself continues to use the full repository (all
  tests, `AGENTS.md`, `.claude/`, `.github/`); only what a *host* clones
  changes. Today's practice of editing the clone and pushing upstream
  becomes a separate `naima carry dev` (or a second, full checkout), not the
  default install.
- V2 (a dot-directory) is rejected: measured in review-host-leakage.md, it
  still leaks 14 test files and 28 tracker items — it fails the owner's
  requirement outright.
- V1 (sparse-checkout) is not the chosen approach: measured, it only passes
  in the *first* worktree — a second worktree's clone (made by the launcher
  from the first) comes out full, because sparse-checkout config is
  per-clone and the launcher does not propagate it. V4 is the only variant
  measured to pass in every worktree.
- The residual leak (29 runtime `.ts` files still reaching `deno check`, and
  either `tsc` or `deno lint`/`fmt`, depending on directory naming) is
  accepted and addressed only via the `init`-printed exclude lines above, per
  review-host-leakage.md's own conclusion that no measured tool has a "root
  marker" it would otherwise respect.

## Documentation

`docs/install.md` documents the dist branch, what `naima update` fetches,
and the `--write-excludes`-equivalent opt-in flag; `docs/using-naima.md`
documents that a host's own tracked material lives in its own
`naima-data/`; `naima guide`'s own output changes (drops `AGENTS.md`).

## Attachment

`review-host-leakage.md`: the full measurement — which tools leak today (V0),
the four mitigation variants tried (V1 sparse, V2 dot-dir, V3 both, V4 dist),
and the per-tool, per-variant result table this decision is based on.

## Implementation (branch `claude/host-dist`, 2026-09-30)

Decisions taken while implementing, where the definition left a choice:

- **One branch of the same repository**, `dist`, not a second repository:
  `source` stays Naima's URL; `update` follows `dist` when the source has
  it, `main` otherwise (forks, local sources). No new `naima.json` key.
- **The allowlist** is `dist.json` (the only source of truth); the builder
  is `scripts/dist.ts` (git plumbing from the commit's own tree:
  reproducible, no commit when no shipped file changed, never moved back by
  a late run). The measured 52 files are 58 now: `src/core/excludes.ts` and
  the five flow commands.
- **The flow commands** are meant for hosts (docs/flows/README.md offers
  them), so they ship with the skill, in `skills/naima/commands/flow/`;
  Naima's own `.claude/commands/flow` is a link to them.
- **Naima's self-tracking follows its dist**, as every project does; the
  current lock on a main commit keeps working until the next update.
- **`naima carry dev`** is not added: changing Naima is done on a full
  checkout of main (docs/install.md#modifying-naima).
- **`init --write-excludes`** is the opt-in flag; the launcher grants write
  to exactly `deno.json`, `deno.jsonc`, `tsconfig.json` and
  `.prettierignore`, for that command only.

Proof: `tests/project-dist-holds-only-what-runs-naima` (offline half passed;
the online half needs the first dist push) and
`tests/ci-runs-pinned-linux-macos-pushes-dist`.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/evidence-close-5

Reopened: the linked proving test (tests/project-dist-holds-only-what-runs-naima) verifies the dist-branch mechanism, which no longer exists (src/dist.test.ts is gone, aebd210 replaced dist with copy-on-install). Its own CI-side counterpart (tests/ci-runs-pinned-linux-macos-pushes-dist) is withdrawn for the same reason. Evidence does not match the shipped implementation, so this is not proof. A real, current proof exists for the related but distinct item features/copy-install-program-plain-copy-naima-from (tests/copy-install-end-end-program-exactly-naima, red-then-green, passed) — the owner should judge whether these two items are the same requirement under copy-on-install and should be merged, or whether host-leakage needs its own fresh proving test.

### 2026-10-01 — Vincenzo Ciancia, on claude/final-sweep

Final sweep (claude/final-sweep): the shipped mechanism is copy-on-install (aebd210, features/copy-install-program-plain-copy-naima-from): copyProgram() in naima/src/core/program.ts checks out only naima/ of the locked commit. The Approach above (a dist branch) is what was replaced. New proof, red then green: tests/host-leakage-copy-install-installed-program-holds (test/runtime-folder.test.ts) reads the installed program off the disk — no test, tracker item or agent rule, exactly naima/ plus the copy record — and checks the host's own item lands in its own naima-data/. The old proof tests/project-dist-holds-only-what-runs-naima is withdrawn.
