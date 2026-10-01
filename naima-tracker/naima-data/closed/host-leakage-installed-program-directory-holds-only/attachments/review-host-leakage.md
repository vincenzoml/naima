# Does the installed Naima clone leak into the host project?

**Verdict: yes, for most default commands.** The clone at `<host>/naima-tracker/naima/` is ignored by git, but most test runners, type-checkers and formatters walk the filesystem and pay no attention to `.gitignore`. On a default run they pick up Naima's 14 test files, 57 tests and 44 `.ts` files. Deno's lint and fmt, ripgrep and `git grep` skip the clone. Naima's install docs and `init` recommend no exclusions.

## Setup (reproducible)

- Scratch hosts are in `scratchpad/leak/{deno,node,bun,tsc}`. Each is a git repo with one commit, holding one host test (`src/add.test.ts`) plus that tool's config.
- Naima was installed the documented way (docs/install.md), cloning from the local repo (commit 4f11b21) instead of GitHub. After `git clone … naima-tracker/naima`, `deno run -A naima-tracker/naima/naima.ts init` exited 0. It wrote only `naima-tracker/{README.md,.gitignore,naima-data/naima.json}`, and the `.gitignore` contains just `/naima/`.
- What the clone contains:
  - 14 `*.test.ts` files and 44 `.ts` files
  - `deno.json` and `package.json`
  - `AGENTS.md` and `CLAUDE.md`
  - 5 slash-command files under `.claude/commands/flow/*.md`
  - `.github/`, `skills/` and `docs/`
  - Naima's own tracker, `naima-tracker/naima-data/`, with 28 items
- Versions used: Deno 2.9.7, Bun 1.4.2, Node 26.5.0. tsc, vitest and prettier came from the npx cache.
- Logs are in `scratchpad/leak/out/*.log`, with the exit summary in `out/summary.txt`.

## Tools: leak or not

The host's own suite is 1 test in every case, so any extra count comes from the clone.

| Host / command | Leaks? | Evidence |
|---|---|---|
| Deno: `deno test -A` | **yes** | `ok \| 58 passed`: 14 test files under naima-tracker/naima/ were run |
| Deno: `deno task test` (task is `deno test`, no `-A`) | **yes, and it breaks the host's CI** | `FAILED \| 8 passed \| 44 failed`, `NotCapable: Requires read access to ".../naima-tracker/naima/..."`, exit 1 |
| Deno: `deno check` | **yes** | 44 `Check naima-tracker/naima/...` lines |
| Deno: `deno lint` | no | `Checked 2 files` (ignored files are skipped) |
| Deno: `deno fmt --check` | no | `Found 4 not formatted files in 5 files`, none of them in the clone |
| Node: `npm test` → `node --test "**/*.test.ts"` | **yes** | `# tests 58` / `# pass 58` |
| Node: `node --test` (no args, default patterns) | **yes** | `# tests 58` |
| Bun: `bun test` | **yes** | `Ran 58 tests across 15 files` |
| TypeScript: `tsc --noEmit` (tsconfig with the default `include`) | **yes, and it breaks the host** | 137 errors, 136 of them in the clone, e.g. `naima-tracker/naima/naima.ts(7,1): error TS2304: Cannot find name 'Deno'`, exit 2 |
| Vitest: `vitest run` | **yes, and it breaks the host** | `Test Files 14 failed \| 1 passed (15)`, exit 1 |
| Prettier: `prettier --check .` | **yes** | 74 of the 77 flagged files are in naima-tracker/naima/ |
| ripgrep: `rg -l import .` | no | 0 files from the clone (it respects .gitignore). With `-uu`: 49 |
| `git grep` / `git ls-files` | no | 0 |
| `grep -r` | yes | 49 files from the clone (expected: grep ignores .gitignore) |
| ESLint, Jest | not tested | not in the npx cache. Flat-config ESLint does not read .gitignore by default, so it would likely leak (inference) |
| GitHub Actions | no | only the repository root's `.github/workflows` is read, and the clone is not in git |

Note: Naima already hit this problem in its own repository. Commit 068ace6 reads "`bun test src` also matched the tests in naima-tracker/naima/", and it was fixed only for Naima itself, by scoping its own scripts to `src/`.

## Naima's own tracker data

- **From the host root:** the host's Naima does not read the clone's data. `naima check` gives `0 items, 20 checks … all invariants hold` and `naima list` gives `0 items`.
- **From anywhere inside the clone:** the data directory is "the first naima-tracker/naima-data/ walking up" (from the test name in src). So with the working directory at `naima-tracker/naima/src`, `naima list` lists **Naima's own 28 items** and `naima check` reports `28 items`. The host has 0 items.
  - An agent or person who `cd`s into the clone, for example to edit Naima as docs/install.md invites ("Edit `naima-tracker/naima/`, commit there"), silently works on the wrong tracker.
  - The documented shell alias uses `git rev-parse --show-toplevel`. Inside the clone that resolves to the clone itself, which has no `naima-tracker/naima/naima.ts`, so the alias breaks there.

## Agent instruction files

What the clone holds for agents:
- `CLAUDE.md`, which says "Read AGENTS.md before anything else: it holds every rule for working in this repository"
- `AGENTS.md`, titled "Working on Naima": 104 lines of the Naima owner's rules, modes, worktree and push rules
- `.claude/commands/flow/{open,close,report,where,coordinate}.md`
- `skills/naima/`, which is not under `.claude/`

**Documented behaviour**
- **Claude Code** loads CLAUDE.md files found in subdirectories under the working directory on demand, when it reads files in that subtree (Claude Code memory docs). Host agents are *told* to read files in the clone: `naima guide` points them to the skill, docs and flows "as files" inside it. So as soon as a host agent follows `naima guide`, Naima's `CLAUDE.md` loads, and through it `AGENTS.md`, Naima's development rules, as if they applied to the host.
- **Claude Code** also documents automatic discovery of `.claude/skills/` in nested directories when you work on files there. The clone has `.claude/commands/`, not `.claude/skills/`.
- **Codex** merges AGENTS.md files from the repository root down to the *current working directory*. Only an agent whose working directory is inside the clone picks up Naima's AGENTS.md.
- **The AGENTS.md convention** (agents.md) says the nearest AGENTS.md to the edited file wins. So an agent editing files in the clone applies Naima's rules to them. That is arguably right when the edit is to Naima itself.

**Inference, not verified**
- Whether Claude Code registers nested `.claude/commands/*.md` as `/flow:*` commands in the host session. I found no docs for nested commands, only for nested skills. If it does, they would clash with the host's own `/flow:*` commands, which init does not install.
- Claude Code's Grep and Glob tools are built on ripgrep, which respects .gitignore. So *searches* do not surface the clone (matching the `rg` result above); only direct *reads* do.
- Either way, the rules loaded are scoped to "this repository" but not machine-checkably so. A host agent can take "Don't ask the human", worktree-per-change and the push rules as host policy.

## Existing tracker item?

None. I grepped the titles of all 28 items in Naima's `naima-tracker/naima-data`, plus the item bodies, for leak, host, nested, exclude, sparse, distribution and bun test. Nothing covers host leakage. Related items:
- the feature "Deno distribution: a per-project clone locked by commit" (clause 16, one clone per worktree)
- the test "Bootstrap on a fresh repository leaves only naima-tracker/". That test checks only git-visible changes, which is exactly why this leak goes unseen.

## Suggested fixes (best first)

1. **Publish a runtime-only distribution.** Keep a `dist` or `release` branch, or a `git archive` export with `export-ignore` in `.gitattributes`, that drops `src/**/*.test.ts`, `deno.json`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/` and `naima-tracker/`. The launcher clones or fetches that. This removes every leak in the table without touching host config.
   - Cost: the lock has to name a dist commit, and "edit the clone and send it upstream" needs the full clone. `naima carry dev` could provide that.
2. **Use sparse-checkout in the launcher** (`git sparse-checkout set --no-cone` with a negative pattern for tests and agent files). This keeps a full git clone for updates but removes those files from disk. It is cheap, and it keeps the lock on the main commits.
3. **Make the data directory lookup stop at the host.** When the working directory is inside `naima-tracker/naima/`, resolve to the *outer* `naima-tracker/naima-data`. Or refuse to run, saying "you are inside the program clone". This fixes the wrong-tracker problem whatever the distribution.
4. **Rename or relocate Naima's agent files in what ships.** For example, move `AGENTS.md` and `CLAUDE.md` to `docs/contributing/`, or keep them only on the development branch, so nested-directory discovery finds nothing. Or start each with an explicit scope guard: "applies only when the task is to change Naima itself; if you are working on a host project, ignore this file".
5. **Write exclusions at init, opt-in** (`naima init --exclude`), into host configs that exist:
   - `deno.json` `"exclude": ["naima-tracker/naima/"]`
   - tsconfig `exclude`
   - `.prettierignore`, eslint `ignores`, vitest `exclude`, `bunfig.toml` test root
   - This conflicts with the "nothing outside naima-tracker/ is touched" invariant, so at minimum document it in docs/install.md.
6. Add a test for fix 1 or 2: after bootstrap, `deno test`, `bun test`, `node --test` and `tsc` run in a fresh host each report only the host's own tests and files.

## Mitigations (measured)

The harness is `scratchpad/leak/mit/variant.sh <V>`. All four variants ran in parallel, each on its own 4 hosts: `mit/V*/{deno,node,bun,tsc}`. Raw results are in `mit/all-results.txt` and `mit/counts.txt`, logs in `mit/V*/out/`. The source was Naima 4f11b21; the older lock used for the alignment test was 7a5ef46. The Naima repo was not modified.

### Runtime set (52 files)

Found from the import graphs (`deno info` of `naima.ts` and of `src/cli.ts`, which the launcher spawns with `--no-config --no-lock`), plus the files the program reads at run time:

- `naima.ts`, and `src/**/*.ts` minus `src/**/*.test.ts` and `src/core/testing.ts` (a test helper outside both graphs). That is 29 `.ts` files. All plugins are imported statically through `src/builtins.ts`.
- `docs/**` (19 files) and `skills/naima/SKILL.md`. `naima guide` prints `skills/naima/SKILL.md`, `docs/README.md`, `docs/flows/README.md`, `docs/format.md` and `docs/install.md`. docs/skill.md tells hosts to symlink `skills/naima`. The pages link to each other, so all of `docs/` ships.
- `LICENSE` and `NOTICE` (licence files must stay), and `README.md`.
- **Not needed at run time:** `deno.json` and `package.json` (the launcher runs with `--no-config`), `.github/`, `naima-tracker/` (Naima's own 28 items), all tests.

Ambiguous, and my call on each:
- **`AGENTS.md`:** dev-only ("For anyone … who changes this repository"). But `naima guide` lists it as `rules`, so every trimmed variant prints a dangling `rules naima-tracker/naima/AGENTS.md`. Fix in Naima: drop that line from `guide`, or point it at a host-facing rules page.
- **`.claude/commands/flow/*.md`:** they are Naima's own slash commands, but docs/flows/README.md offers them "to adopt … in another project". Excluded here. If they are meant for hosts, ship them under `docs/flows/` or `skills/`, not in a `.claude/` directory an agent harness may auto-load. The link to `../../.claude/commands/flow/` then dangles; the host's `naima check` did not flag it.
- **Dev-oriented docs** (`docs/architecture.md`, `plugin-contract.md`, `documentation.md`, `reference.md`): kept. Host plugin authors need them, and trimming them would break links from the pages `guide` points to.
- **`README.md`:** kept. It is the landing page and its links point into `docs/`.

### Variants

- **V1:** `git clone --filter=blob:none --no-checkout file://…` + `sparse-checkout set --no-cone --stdin` + checkout.
  - Patterns (`mit/sparse-patterns.txt`): `/*`, `!/*/`, `/src/`, `!/src/**/*.test.ts`, `!/src/core/testing.ts`, `/docs/`, `/skills/`, `!/AGENTS.md`, `!/CLAUDE.md`, `!/deno.json`, `!/package.json`.
- **V2:** full clone in `naima-tracker/.naima/`, with `"program": "../.naima"` in naima.json and `/.naima/` in `naima-tracker/.gitignore`. Both edits are by hand, because `init` hard-codes `naima/`.
- **V3:** V1 + V2.
- **V4:** a generated runtime-only repository (`mit/dist.git`, whose `main` holds the runtime set of each source commit), cloned the documented way. **Lock:** `commit` names the *dist* commit and `source` is the dist repository. `naima update` asks `refs/heads/main` of the source, so the dist must be `main` of its own repository, or `update` must learn another branch. Put the source commit in the dist commit (I used the message `dist of <src sha>`; a trailer is better) so it can be traced.

### Owner acceptance: what the program directory holds after install

| | test files | `src/core/testing.ts` | tracker items (meta.json) | AGENTS/CLAUDE/.claude/.github/deno.json/package.json | files on disk | host naima-data after init |
|---|---|---|---|---|---|---|
| V0 (today) | 14 | 1 | 28 | all present | 180 | `naima.json` only |
| V1 sparse | **0** | **0** | **0** | **0** | 52 | `naima.json` only |
| V2 dot-dir | 14 | 1 | 28 | all present | 180 | `naima.json` only |
| V3 sparse+dot | **0** | **0** | **0** | **0** | 52 | `naima.json` only |
| V4 dist | **0** | **0** | **0** | **0** | 52 | `naima.json` only |

**V2 fails** the owner's requirement.
**V1 and V3 pass only in the main worktree.** A second worktree's clone is made by the launcher (from the main clone), and it comes out *full*: 14 tests and 28 items, because sparse-checkout is per-clone config that the launcher does not copy.
**V4 passes everywhere**, second worktree included: 0 tests, 0 items.

### Tools

Cells read: files from the clone that the tool picked up → whether the host run passes. The host alone gives 1 test.

| Tool | V0 today | V1 sparse | V2 dot-dir | V3 sparse+dot | V4 dist |
|---|---|---|---|---|---|
| `deno test -A` | 58 tests (14 files) → pass | 1 → pass | 58 (14 files) → pass | 1 → pass | 1 → pass |
| `deno task test` (no `-A`) | 44 failed → **FAIL** | 1 → pass | 44 failed → **FAIL** | 1 → pass | 1 → pass |
| `deno check` | 44 files → pass | 29 runtime files → pass | 44 → pass | 29 → pass | 29 → pass |
| `deno lint` | 0 (gitignore respected) → pass | 0 → pass | 46 files, 12 problems → **FAIL** | 31 files, 1 problem → **FAIL** | 0 → pass |
| `deno fmt --check` | 0 | 0 | 107 of 142 flagged | 54 of 55 flagged | 0 |
| `npm test` / `node --test` / `node --test "**/*.test.ts"` | 58 → pass | 1 → pass | 1 → pass | 1 → pass | 1 → pass |
| `bun test` | 58 tests, 15 files → pass | 1 → pass | 1 → pass | 1 → pass | 1 → pass |
| `tsc --noEmit` (default include) | 136 errors from the clone → **FAIL** | 68 from the clone (`Cannot find name 'Deno'`) → **FAIL** | 0 | 0 | 68 → **FAIL** |
| `vitest run` | 14 failed files → **FAIL** | 1 → pass | 14 failed → **FAIL** | 1 → pass | 1 → pass |
| `prettier --check .` | 74 files | 44 | 74 | 44 | 44 |
| jest, eslint | not cached, not run | | | | |

Notes on the table:
- The host's own files already fail `deno fmt --check`, `prettier --check` and `tsc` (the missing vitest type), so for those three the count is the leak signal, not the exit code.
- **Deno** respects `.gitignore` only in `lint` and `fmt`, and apparently not for a dot-directory. I tried a nested `/.naima/`, `.naima/` and `.naima`, and a root-level `naima-tracker/.naima/`: all gave `Checked 31 files`. Without the `.gitignore`, `naima/` gives 31 too. `deno test` and `deno check` never respect `.gitignore`.
- **A dot-directory hides the clone from** tsc's default include, node's `--test` globs and bun. It **exposes the clone to** `deno lint` and `deno fmt`.
- **No variant is leak-free.** The runtime `.ts` files still reach `deno check` (passes), `prettier`, and either `tsc` (when not in a dot-directory) or `deno lint`/`fmt` (when in one).

### Naima still works from the host

These pass in every variant:
- `init`, `new todos`, `list` (1 item), `check` ("all invariants hold")
- `guide` (prints paths; `rules` dangles in V1, V3 and V4)
- `update --check` ("current")
- lock alignment to an older commit and back: HEAD moved to 7a5ef46 and back to 4f11b21 (dist: 448d4a6 and back to a9a73ae). **The sparse patterns held**: 0 tests on disk after each checkout, `core.sparseCheckout=true`.
- `update`
- a second worktree's `naima check`

The worktree's clone came from the main clone, and `program: ../.naima` was honoured.

**`git pull` fails in every variant**, V0 included: the launcher leaves the clone at a detached HEAD. That has nothing to do with sparse checkout. Fetch plus checkout of the locked commit works under sparse checkout.

**Git versions.** I tested on 2.50.1. The minimums below are my inference from Git's release notes, not measured:
- `sparse-checkout set --stdin`: 2.26
- an explicit `--no-cone`: 2.35+; cone became the default in 2.37, so non-cone must be passed explicitly
- `--filter=blob:none`: server support (GitHub has it). A plain local path ignores the filter; use `file://`.

### Recommendation

**Primary: V4, a runtime-only distribution.** This is what npm's `files` allowlist does for a package, and what GitHub Actions (JavaScript actions) do by publishing to a dist or release branch.
- CI builds `dist` from each commit on `main`: the runtime set above, with `Source-Commit: <sha>` in the commit.
- Hosts clone and lock the dist. Reusing the full repository for this is possible only if `update` reads the `dist` ref instead of `main`.
- It is the only variant that meets the owner's requirement in every worktree, with no launcher or git-version dependency.
- Development work on Naima uses its own repository, not the host's clone. Today's "edit the clone and commit there" becomes a separate `naima carry dev`, or simply a second checkout.

**V1 (sparse checkout) as the fallback.** This is Microsoft's practice for giant monorepos (Scalar, `sparse-checkout`); there it is about scale, not hygiene.
- It is acceptable only if the launcher itself applies the patterns every time it clones, at `src/core/program.ts:89` and `:140`. The measured second-worktree clone came out full.
- It also inherits the git-version floor and the partial-clone server requirement.

**Keep the directory name `naima/`.** A dot-directory hides the clone from tsc, node and bun but exposes it to Deno's lint and fmt. It trades one set of leaks for another, and `init` does not support it.

**Residual leak under any variant:** 29 runtime `.ts` files reach `deno check`, `tsc` (68 `Deno`-global errors) and `prettier`. Close it with one of:
1. Have `init` print, or opt-in write, one exclude line per host config it finds: `deno.json` `exclude`, tsconfig `exclude`, `.prettierignore`.
2. Ship the runtime as one bundled `.js` file in the dist. Not measured: tsc skips `.js` without `allowJs`, but prettier would still see it.
3. Ship a root marker that tools respect. None of the measured tools has one: Deno needs `exclude` in the host's config, tsc needs `exclude`, prettier needs `.prettierignore`. So option 1 it is.

**Also fix in Naima, whatever the variant:**
- `guide` must stop listing `AGENTS.md`.
- The `.claude/commands/flow` commands, if meant for hosts, move out of `.claude/`.
