# Naima: consolidated code review

Repository: `/Users/vincenzo/data/local/repos/naima` at `main` 4f11b21 (not modified).
Sources merged:
- `review-core-correctness.md`, the core bug hunt (cited below as "core #n")
- `review-plugins-correctness.md`, the plugin bug hunt ("plugins Hn/Mn/Ln")
- `review-extensibility.md`, the open-endedness review ("ext Hn/Mn/Ln")
- `review-cleancode.md`, the clean-code and engineering review ("clean Hn/Mn/Ln")
- `review-host-leakage.md`, whether the installed Naima clone leaks into the host project (referenced only; its mitigation section is still being written).

Repro scripts live in `scratchpad/core-repro/`, `scratchpad/plugins-repro/` and `scratchpad/cleancode/` (run with `deno run -A <script>`).

**Spot-check.** I opened the cited `file:line` for the 12 most severe findings. All 12 hold, so none was dropped or downgraded. They are marked **[verified]** below. Everything else carries the status its source review gave it.

---

## 1. Verdict

| Requirement | Grade | Reason |
|---|---|---|
| Correct | **C** | The model is sound, but four high bugs are real: git option injection from committed data, silent overwrite of an item on `naima new`, coordination missing other worktrees' claims, and stale proofs still closing items. |
| Clean code | **B** | Strict TypeScript with zero `any` and zero dependencies. Against that: no formatter or linter, 70 lines over 160 characters, three git wrappers, and an untyped error model. |
| Open-ended, extensible forever | **C-** | Plugins can only add new names to 12 fixed contribution kinds, from inside a fork. They cannot extend, configure, namespace or declare new kinds. |
| Extremely modular | **B-** | Plugins never import each other. But they depend on each other through undeclared field and type names, and the core itself names gate and verifier concepts. |
| State-of-the-art engineering | **B-** | Strong points: a versioned format, pure migrations and a generated, checked reference. Missing: plugin-contract versioning, an I/O seam, pinned CI, and verification of the lock's source. |

---

## 2. Owner decisions

These change the core, the public format or the plugin contract, or they have several valid designs. They are ordered so that a decision others depend on comes first.

### D-01. How are plugins configured, including first-party ones? (ext H3, clean H2, plugins M6, ext M7, ext M11)
- **Question:** should `naima.json`, the project's lock and config file, be able to set options for, disable or replace any plugin, including the first-party ones?
- **Today [verified]:**
  - `src/builtins.ts:16-18` calls every first-party factory except `gates` without options.
  - `src/core/config.ts:99` refuses a first-party name in `plugins`.
  - So the documented options of `beta-markers` (the scanner for beta-marker comments) and `docs` (the documentation checker) can never be set, and the `reference-current` check (the reference is up to date) is dead in every project.
  - The top-level `gates` key is a plugin's setting stored in the core schema.
- **Options:**
  - (a) Remove the unreachable options and the `reference-current` check, and keep the defaults as constants.
  - (b) Add a `plugins` table keyed by plugin name, holding `options`, `enabled: false` and `replacedBy`. Move `gates` into it with a migration. Add per-check severity (`checks: {id: off|note|problem}`), as ESLint does.
  - (c) Options only, with no disable and no replace.
- **Recommendation:** (b). Rank weights, check severities, gate config and trunk naming all depend on this.

### D-02. One flat global namespace, or qualified names? (ext H5)
- **Question:** how do two independent plugins coexist when both declare the same name, for example a `priority` field?
- **Today:** a name collision is a fatal load error with no way out. Checks, summary sections and rank terms are not even checked for collisions.
- **Options:**
  - (a) Keep the flat namespace.
  - (b) Give every contribution a qualified id `plugin/name`, with short aliases while they stay unambiguous. Stored data keeps short names. The project resolves on-disk collisions with a `rename` map.
  - (c) Require third-party plugins to prefix the names they store (`x-<plugin>-…`).
- **Recommendation:** (b), decided before any third-party ecosystem exists. Also collision-check checks, summary sections and rank terms now (see the fix R-21).

### D-03. Generic extension points instead of 12 hard-coded kinds (ext H1, ext M7, ext M8, ext L20, ext L23)
- **Question:** may plugins declare their own extension points, the way the verifier plugin needed one and got it only by editing the core?
- **Today:** the kinds are fixed fields in `src/core/types.ts:164-184` and are merged by hand in `src/core/registry.ts`. The `plugins` command and the docs plugin list them by hand. `GateDef` and `Verifier` are core types.
- **Options:**
  - (a) Keep the fixed list and add kinds to the core as needed.
  - (b) A declarative `ExtensionPoint<T>` (id, `says`, key, validate, document), with `contributes: {pointId: [...]}`. The 12 kinds become built-in points, and gates and verifiers move out of the core. Field kinds and reference resolvers become points too.
- **Recommendation:** (b), keeping the typed fields as sugar. This is what makes "the core does not move" literally true. A pluggable storage port (ext L21) is **not** recommended: the fixed on-disk layout is the compatibility boundary between forks.

### D-04. Can a plugin or project extend another plugin's types and fields? (ext H2, ext M9, ext M17)
- **Question:** how does a project add a `blocked` status to `bugs`, or let a third-party `incidents` type use `fixedOn` (the "fix has landed" date)?
- **Today [verified]:** `fixedOn` is `appliesTo: ["bugs","todos","closed"]` at `src/plugins/trackers/index.ts:220`, and a second declaration is a load error.
- **Options:**
  - (a) An additive `extends` contribution, under rules: new statuses and enum values are allowed, and redefining a status is allowed only when its category matches.
  - (b) Traits: a type declares `traits: ["fixable"]` and a field applies to a trait.
  - (c) Both.
- **Recommendation:** (c).
  - Traits for applicability, and `extends` for statuses and enum values.
  - Add open-ended `StatusDef.flags` next to the core's open/done category, and an optional transitions map.
  - Let the `gate` field (an item's release gate) take its enum values late, from `registry.gates`, and allow several gates per item.

### D-05. How do plugins share vocabulary without importing each other? (ext H6)
- **Question:** should the fields and types that one plugin reads from another be declared, or be abstract roles?
- **Today:**
  - `gates` (the release-gate plugin) reads `fixedOn`, `runBy`, `verified-by` and `verifies`, all owned by `trackers` (the bugs/todos/tests plugin).
  - `trackers` hard-codes the `closed` and `bugs` types.
  - `docs` hard-codes `features`/`shipped`.
  - A replaced vocabulary fails silently.
- **Options:**
  - (a) `uses: {fields, relations, types}`, validated at load time.
  - (b) Roles known to the core, which plugins fill in (a "fixed" field role, an evidence relation role, an archive flag on a type), like the existing `proves` flag.
- **Recommendation:** (b), with (a) as the stopgap. Depends on D-03 and D-04.

### D-06. How does a plugin say that a proof is still current? (plugins H4, plugins M3)
- **Question:** `close` and `gates` treat any `proves` status as proof. How can the verifier plugin say that its `holds` is stale, and how can a test mark a failed or violated status as refuting?
- **Today [verified]:**
  - `lifecycle` at `src/plugins/trackers/index.ts:47-51` only checks `proves`.
  - `close` at `:105-117` archives a bug whose property holds on a changed model, which `naima check` itself reports as void.
  - Under `holdsOn: "code"`, a failed test does not block the gate (`src/plugins/gates/index.ts:53-58`).
- **Options:**
  - (a) `close` runs the checks and refuses when any problem names a `verified-by` item.
  - (b) `StatusDef.proves` becomes a predicate `(item, ctx) => boolean`.
  - (c) A registry-level "evidence is current" predicate that plugins contribute, plus a `refutes: true` status flag.
- **Recommendation:** (c), with (a) as an immediate stopgap. Repro: `plugins-repro/ver.ts` (cases R5, R8).

### D-07. Write-time hooks and vetoes (ext M10, plugins M4)
- **Question:** should core writes (create, set, link, move, close) run plugin `beforeWrite` hooks (which can veto) and `afterWrite` hooks?
- **Why it matters:** it would enable:
  - auto-stamping `triagedOn` (the triage date) on any `set` of a triage field;
  - resetting a property to `open` when its `property`, `model` or `verifier` changes;
  - refusing a manual `status=holds`;
  - enforcing AGENTS.md's rule "a branch does not close its own items on the strength of its own tests" (plugins M4, CONFIRMED not enforced, `src/plugins/trackers/index.ts:98-118`).
- **Options:**
  - (a) No hooks, and each command re-checks.
  - (b) Rollup-style hooks in load order, with every public write helper routed through them.
- **Recommendation:** (b). Enforce the own-branch close rule through it, with a `--force` for the evidence owner.

### D-08. What do cross-branch views read? (plugins H1, ext/clean L12)
- **Question:** the docs promise views of "whatever each worktree is standing on, uncommitted files included". Should the code read every worktree's disk, or should the docs say "committed only"?
- **Today [verified]:** `readAcrossBranches` (`src/core/git.ts:136-146`) reads from disk only the worktree it runs in, and reads the others from their refs. So two workers' uncommitted claims on the same item are never seen by each other, and `claims` on the trunk says "no claims". Repro: `plugins-repro/coord.ts` (case R1).
- **Sub-question:** local branches only, or also `refs/remotes`?
- **Options:**
  - (a) Read each worktree's path from `git worktree list --porcelain`.
  - (b) Committed only: `claim` commits at once, and the three docs are corrected.
- **Recommendation:** (a) for worktrees, and local branches only, with the docs saying "every local branch".

### D-09. Must item slugs be unique across branches? (core #6)
- **Question:** two branches that open an item with the same title write the same `bugs/<slug>/meta.json` with different uuids, which gives an add/add merge conflict. That contradicts the worktree-isolation promise.
- **Options:**
  - (a) Always suffix a short uuid prefix (changes on-disk names from now on).
  - (b) At creation, check the slug against unmerged refs (reusing the cross-branch reader).
  - (c) Document "link duplicates, never re-create".
- **Recommendation:** (b), with (a) only as the fallback when refs are unreadable. Repro: `core-repro/r4.sh`.

### D-10. Plugins from outside the program, API version and capability scoping (ext H4, ext M13, ext M16, ext M14 point 5)
- **Question:** may a project load a plugin that lives in its tracker, or in another git source, pinned by hash or commit, without forking Naima?
- **Today:** `src/core/config.ts:96-110` only loads paths inside the program. `src/core/index.ts` exports almost the whole core, including `runCli` and `migrate`, so the rule "plugins import only `core/index.ts`" restricts nothing.
- **Options:**
  - (a) Forks only (today).
  - (b) Pinned local and git plugin sources, plus a `CONTRACT` version checked at load, plus a split `api.ts`/`internal.ts`, plus a frozen registry and an API injected into the factory.
- **Recommendation:** (b), after D-01 and D-02.

### D-11. Per-plugin data migrations (ext M12)
- **Question:** the format is a single integer owned by the core. How does a plugin rename a field or move its directory?
- **Options:**
  - (a) Every plugin change bumps the core format.
  - (b) `formats: {plugin: n}` in `naima.json`, and a `migrations` contribution per plugin, run after the core's.
- **Recommendation:** (b). Needed before D-01 moves `gates` config, if that move is to be migrated.

### D-12. Trust policy for the lock (clean M9, clean M1)
- **Question:** today any ordinary command silently follows a pulled change of `source`/`commit` (`src/core/program.ts:113` rewrites `origin`). Should a source change need explicit acceptance, and should signed commits be an option?
- **Linked question:** the launcher grants only `--allow-run=git` (`src/launcher.ts:49`) **[verified]**. Every real verifier adapter that runs an external tool (for example TLC, the TLA+ model checker) is therefore impossible under the launcher.
- **Options:**
  - (a) Keep automatic following, and document it.
  - (b) Refuse a changed `source` until `naima update --accept-source`, print "locked commit moved a→b", and offer an opt-in `verify: "signed"`.
  - (c) Let verifiers declare `runs: string[]`, collected at alignment time into `--allow-run`.
- **Recommendation:** (b) and (c).

### D-13. Views return data; checks may be async (ext L19, ext L18)
- **Question:** should views and summaries return `{data, text()}`, with renderers for text, JSON and markdown, and should checks, gates and views be allowed to return promises?
- **Recommendation:** yes, in the same plugin-contract version bump as D-10.

### D-14. Triage fallbacks (plugins L6)
- **Question:** what rank does an unset impact, priority or effort take? The code uses 2.5, 2.5 and 1.5 (`src/plugins/triage/index.ts:87-89`), so an unsized item ranks ahead of every L and XL item. The docs say "counts as the middle" and "an unsized item sinks".
- **Recommendation:** middle for impact and priority, and the worst rank for effort, so that an unsized item sinks. Then regenerate the reference.

### D-15. Host leakage of the installed clone (`review-host-leakage.md`)
- **Question:** the clone at `<host>/naima-tracker/naima/` is picked up by the host's tools: Deno test/check, `node --test`, Bun, tsc, Vitest and Prettier. That breaks the host's CI for `deno task test`, tsc and Vitest. Running `naima` inside the clone also silently opens Naima's own tracker.
- **What to decide:** where the clone lives, and what `init` writes. The options are in that file's mitigation section, which is still being written.

---

## 3. Fix without discussion

Severity order. Status is CONFIRMED (reproduced or read as certain) or PLAUSIBLE (reasoned, not run).

| id | title | sev | status | where | failure | fix | repro |
|---|---|---|---|---|---|---|---|
| R-01 | Git option injection through `source` **[verified]** | high | CONFIRMED | `src/core/program.ts:89,129,140,216`; `src/core/config.ts:33` | A `naima.json` with `source: "--upload-pack=<cmd>"` runs `<cmd>` on `naima update --check`, which agents run every session. | Reject a `source` that starts with `-` in `parseLock`, put `--` before every URL or path argument, and add a regression test. | `cleancode/inj.ts` |
| R-02 | `naima new` overwrites an existing item (case-insensitive file system, or two concurrent runs) **[verified]** | high | CONFIRMED | `src/core/item.ts:25,63-70` | The slug-taken test is case-sensitive and `mkdirSync({recursive})` never fails, so an existing `Crash-save/` loses its id and prose, and 8 parallel `new` runs leave 1-3 items. | Compare taken slugs lowercased. Create the item directory with a non-recursive `mkdirSync`, and on EEXIST retry with the next suffix. | `core-repro/r1.ts` (section 4), `core-repro/r3.sh` |
| R-03 | A stale local copy of another branch's claim overrides that branch's newer claim **[verified]** | high | CONFIRMED | `src/core/git.ts:145` | From the trunk, worker `w` shows only its old claim (alpha, marked "working tree") while its branch holds alpha and beta. | A local file wins only when its recorded `branch` is the current one. Otherwise prefer the owner branch's ref. | `plugins-repro/coord.ts` (R2) |
| R-04 | A property's `holds` survives a change to the property, verifier, model path or options **[verified]** | high | CONFIRMED | `src/plugins/verifier/index.ts:140-146` | After `set property="some gamma"`, the status stays `holds`, `check` is green, and the property can close a bug. | In the property-evidence check, compare `run.property`, `run.verifier` and `run.model` (plus a stored options hash) with the current meta. | `plugins-repro/ver.ts` (R4) |
| R-05 | A status of `__proto__`, `constructor` or `toString` is accepted **[verified]** | medium | CONFIRMED | `src/core/base.ts:25`, `src/core/check.ts:38`, `src/core/registry.ts:36` | `in` matches `Object.prototype` keys, so `set status=__proto__` passes `check`, and the item counts as open with no status definition. | `Object.hasOwn(statuses, raw)` in all three places. | `core-repro/r1.ts` (section 1) |
| R-06 | An adapter's out-of-contract verdict erases the property's status **[verified]** | medium | CONFIRMED | `src/plugins/verifier/index.ts:79-91` | A `{verdict:"pass"}` result writes a meta.json with no status, and every later `check` fails. A thrown non-Error gives `output: undefined`. | Validate the result: anything outside the four verdicts, or a result without a string output, becomes `error`. Use `String(e)` for non-Errors. | `plugins-repro/ver.ts` (R6) |
| R-07 | `naima init` locks a commit the source lacks, and may commit a token **[verified: first part]** | medium | CONFIRMED (token part PLAUSIBLE) | `src/core/cli.ts:119-127` | Init from a clone with an unpushed commit writes a lock nobody else can fetch. An `https://user:token@…` origin is written verbatim into `naima.json`. | Refuse on a dirty tree or when origin lacks HEAD (as `localWork` already does for align), and strip userinfo from the URL. | `core-repro/r5.sh` |
| R-08 | Trunk detection and detached HEAD handling **[verified: trunk]** | medium | CONFIRMED (the detached-HEAD claim part PLAUSIBLE) | `src/core/git.ts:58-64,87,92-94,138-145`; `src/plugins/coordination/index.ts:122,203` | A trunk named `develop` makes git fail, so no branch is read. On a detached HEAD, a deleted record is read back, and a claim records branch "HEAD" and is later pruned as stale. | Resolve the trunk from `origin/HEAD`, then `main`, then `master`, and read every local branch if none exists. Skip the HEAD sha. Refuse `claim` on a detached HEAD. | `core-repro/r2.ts` |
| R-09 | `release` of a claim the trunk already carries: the claim comes back | medium | CONFIRMED | `src/core/git.ts:140-145`; `src/plugins/coordination/index.ts:108-110,124,151-158` | After `release`, `claims` still shows it, a second `release` throws, and a re-`claim` writes a second file. | Treat a file present on HEAD but missing in the worktree as deleted, across all refs. `myClaim` should also match the current branch's non-local claims. | `plugins-repro/coord.ts` (R3) |
| R-10 | `naima new --set <bad>` fails but leaves the item on disk | medium | CONFIRMED | `src/core/base.ts:74-76` | A typo exits 2, yet a half-made item exists, and the retry creates `slug-2`. | Parse and validate the assignments against a draft meta, then write the item once. | `core-repro/r1.ts` (section 2) |
| R-11 | Launcher permissions break on a path containing a comma | medium | CONFIRMED | `src/launcher.ts:43` | Deno splits permission lists on commas, so every command fails with `NotCapable`. | Detect a comma and refuse with a clear message, or grant the nearest comma-free ancestor. | `core-repro/r6.ts` |
| R-12 | `triage derive` stamps negated evidence as `measured` | medium | CONFIRMED | `src/plugins/triage/index.ts:78-84` | "Could not be reproduced" gets the highest confidence. | Test for a negation up to 3 words before the positive verb, before the positive test. | `plugins-repro/misc.ts` (R7) |
| R-13 | `Meta` is typed but never validated | medium | CONFIRMED | `src/core/repo.ts:28-30`, `src/core/types.ts:16-22` | `"status": 5` crashes `naima list` with `padEnd is not a function`. | Validate `id`, `title` and `status` in `loadRepo`, and route bad items to `unreadable`. | none |
| R-14 | Windows: backslash paths given to git, and git paths split by the OS separator | medium | PLAUSIBLE | `src/core/git.ts:42,110,115`; `src/plugins/coordination/index.ts:61`; `src/plugins/beta-markers/index.ts:65` | On Windows, every other branch contributes nothing, and the SKIP filter never matches. | Normalise to posix where paths enter or leave git (`projectFiles`, `readAcrossBranches`). | none |
| R-15 | Cross-branch reads start O(refs × files) git processes, repeatedly | medium | CONFIRMED | `src/core/git.ts:84-119`; `src/plugins/coordination/index.ts:74-98,253-279` | With 30 branches, `summary` starts 195 git processes and takes 2.3 s. | Use one `ls-tree -r` per ref and one `cat-file --batch`, memoize per Context, and compute the refs once. | `cleancode/` perf trackers |
| R-16 | Three git wrappers with different error semantics | medium | CONFIRMED | `src/core/git.ts:13`, `src/core/program.ts:33`, `src/core/testing.ts:43`, plus copies in two tests | stderr is discarded, so callers cannot tell "no such ref" from "git missing". | One `runGit` returning `{ok,out,err}`, with `gitOrNull` and `mustGit` derived from it, and one helper for the tests. | none |
| R-17 | No lint or format in the toolchain | medium | CONFIRMED | `deno.json`, the `verify` task, `.github/workflows/ci.yml` | 12 lint errors, all 44 files unformatted, 70 lines over 160 characters, an indentation slip at `src/plugins/beta-markers/index.ts:120-121`. | Add `fmt` and `lint` blocks and add both to `verify`. Reformat in one commit and fix the 11 `require-await` hits. | `cleancode/lint.txt`, `cleancode/fmt.txt` |
| R-18 | CI is not reproducible and runs on Ubuntu only | medium | CONFIRMED | `.github/workflows/ci.yml:17-47` | Actions and runtimes float, so a red build can come from a toolchain release. | Pin actions by SHA, pin Deno and Bun versions, add an OS matrix (or declare Windows unsupported), and set `timeout-minutes` and `concurrency`. | none |
| R-19 | Launcher coverage is lost, and several commands have no test | medium | CONFIRMED | `src/distribution.test.ts:29`; zero-hit lines in `src/core/base.ts`, `src/core/cli.ts:193-203`, `src/plugins/triage/index.ts` | `program.ts` reports 35 % because subprocess coverage maps to deleted paths. `list`, `unlink`, `view`, `types` and `help` are untested. | Run the distribution tests from a `git worktree` (or rewrite the lcov paths), add one test per command, and add property tests for slugify, anchors, field round-trips and migrate. | `cleancode/cov/` |
| R-20 | The dependency-rule test enforces less than it claims | medium | CONFIRMED | `src/arch.test.ts:21-28,43-58` | It misses side-effect imports, template-literal `import()` and `createRequire`, it never scans plugins outside `src/`, and nothing checks that the core names no plugin vocabulary. | Use a module-graph scan (`deno info --json`), widen the scope, and add a "no plugin names in `src/core`" test. | none |
| R-21 | Core commands silently shadow plugin commands, and some kinds skip collision checks | medium | CONFIRMED | `src/core/cli.ts:212-229`, `src/core/registry.ts` | A plugin command named `update`, `carry`, `guide` or `init` loads and can never run. Two checks named `links` both run and cannot be told apart. | Reserve those names in `buildRegistry`, and collision-check checks, summary sections and rank terms. | none |
| R-22 | Untyped error model, and the relaunch code 75 is shared with commands | medium | CONFIRMED (the 75 re-run PLAUSIBLE) | `src/core/cli.ts:234-238`; `(e as Error)` in 5 files; `src/launcher.ts:69` | Usage errors and bugs both exit 2 with no stack. A plugin command returning 75 runs 4 times. | Add a `NaimaError` with a code, a `NAIMA_DEBUG` stack, exit 70 for internal errors, and a `message(e)` helper. Map a command's 75 to 1. Document the exit codes. | none |
| R-23 | Non-atomic writes, and a vendored update deletes the program before checkout | low | PLAUSIBLE | `src/core/item.ts:37`, `src/core/config.ts:83`, `src/core/format.ts:52`, `src/plugins/verifier/index.ts:87`; `src/core/program.ts:143-145` | An interrupted write truncates meta.json. A failed checkout leaves no program. | One `writeJsonAtomic` (temp file, then rename) used everywhere, including `migrate`. Check out into a sibling directory, then swap. | none |
| R-24 | Both directions of a link can be stored | low | CONFIRMED | `src/core/base.ts:45-53`, `src/core/check.ts:61-88` | The link shows twice. | `addLink` also checks the inverse, and the links check reports a doubly stored link. | `core-repro/r1.ts` (section 3) |
| R-25 | Non-Latin titles collapse, in slugs and in the duplicate check | low | CONFIRMED | `src/core/item.ts:19`, `src/core/check.ts:108` | Every Cyrillic or CJK title slugs to `item` and is flagged as a duplicate. | NFKC, then `/[^\p{L}\p{N}]+/gu`, in both places. | `core-repro/r1.ts` (section 5) |
| R-26 | `show` or `set` with no reference acts on the only item | low | CONFIRMED | `src/core/repo.ts:59-60`, `src/core/base.ts:88,130` | The empty string matches every slug. | A usage error on an empty reference, and require at least one pair in `set`. | `core-repro/r7.ts` |
| R-27 | A `date` field accepts impossible dates | low | CONFIRMED | `src/core/fields.ts:6` | `2024-13-99` is stored and passes `check`. | Validate month and day ranges. | `core-repro/r7.ts` |
| R-28 | Some item directories are invisible, and a stray directory is only a note | low | CONFIRMED | `src/core/item.ts:52`, `src/core/check.ts:90-98` | `_draft/`, a symlinked item and a misspelled `bgus/` pass `check`. | Report them as unreadable, and make a stray directory a problem (or correct architecture.md). | `core-repro/r8.ts` |
| R-29 | A relative `source` is accepted | low | PLAUSIBLE | `src/core/config.ts:33`, `src/core/program.ts:113` | Later fetches resolve it from another directory and fail. | Reject a local source that is not absolute. | none |
| R-30 | Three file walkers with their own skip rules, and `projectFiles` returns non-files | low | PLAUSIBLE | `src/core/git.ts:44-53`, `src/plugins/beta-markers/index.ts:36-59`, `src/plugins/docs/index.ts:251-262` | EISDIR on a submodule, a read outside the repository through a symlink, and the two plugins scan different trees. | One core `walk(root,{include,skip})` that keeps only `lstat().isFile()` entries. | none |
| R-31 | A beta marker naming a closed item is reported as "no item" | low | CONFIRMED | `src/plugins/beta-markers/index.ts:88-93` | The wrong message after `close` moves the item. | Retry by slug or through `closedFrom`, and word the message from the resolve error. | `plugins-repro/ver.ts` (R11) |
| R-32 | The example regex adapter counts a phantom last line | low | CONFIRMED | `src/plugins/verifier/adapters/example-regex.ts:25-28` | `never ^$` is violated on a normal file, and CRLF lines keep their `\r`. | `text.replace(/\r?\n$/,"").split(/\r?\n/)`. | `plugins-repro/ver.ts` (R10) |
| R-33 | The features-documented check accepts an empty or directory docs reference | low | CONFIRMED | `src/plugins/docs/index.ts:241-247,326` | `docs=#x` passes with no documentation. | Require a non-empty path to a `.md` file. | `plugins-repro/misc.ts` (R13) |
| R-34 | Setext headings produce no anchors | low | CONFIRMED | `src/plugins/docs/index.ts:223-238` | A valid link fails the links-resolve check. | Recognise `===` and `---` underlines. | `plugins-repro/misc.ts` (R14) |
| R-35 | The gated-proof-is-gated check ignores its "or ranks below" clause | low | CONFIRMED | `src/plugins/gates/index.ts:121-135` | The code disagrees with its own `says`. | Implement the rank comparison, or drop the clause and regenerate. | none |
| R-36 | Numeric arguments are not validated | low | CONFIRMED | `src/plugins/coordination/index.ts:232`, `src/plugins/triage/index.ts:150` | `pass --list all` prints "no session notes". | A shared `positiveInt(raw,name)` in `args.ts`. | `plugins-repro/misc.ts` (R15) |
| R-37 | The claim-pruning command (`prune`) skips stale claims read from other refs | low | CONFIRMED | `src/plugins/coordination/index.ts:204-207` | It says "every claim names a branch that exists" while `claims` lists stale ones. | List the non-local stale claims too, naming the ref that must drop them. | none |
| R-38 | Gates option documentation names a non-existent file | low | CONFIRMED | `src/plugins/gates/index.ts:6-7,167`; `docs/reference.md:656` | It says `naima/config.json`, and the header shows an obsolete shape. | Correct the text to `naima-tracker/naima-data/naima.json` and regenerate. | none |
| R-39 | The generated reference embeds the project's configured gates | low | CONFIRMED | `src/plugins/gates/index.ts:140-149,176`; `src/plugins/docs/index.ts:142-206` | Editing a gate breaks `deno task verify`, and each project gets a different "program" reference. | Render configured gates in a separate project-specific section, or leave them out. | none |
| R-40 | `--allow-env` is unrestricted | low | CONFIRMED | `src/launcher.ts:50` | The program can read every token in the environment. | Grant a named list (HOME, PATH, the NAIMA_* and GIT_* variables…) and document it. | none |
| R-41 | Cache invalidation is inconsistent | low | CONFIRMED | `src/core/base.ts:42,166`; `saveMeta` | The inverse-link map goes stale after `unlink` or `set` in the same run. | Route writes through a repo method that invalidates, and drop the manual `reload()` calls. | none |
| R-42 | Field access through the index signature | low | CONFIRMED | `src/core/types.ts:21`, 90 sites | A typo in `fixedOn` compiles. | Enable `noPropertyAccessFromIndexSignature`, plus a typed `field<T>(item, def)` accessor. | none |
| R-43 | Helpers duplicated between the launcher and the CLI | low | CONFIRMED | `src/launcher.ts:25,28,34`; `src/core/cli.ts:78,88,138`; `src/core/program.ts:49` | `--data` is parsed two different ways. | Export `real`, the data-flag parser, `programOf` and `short` once, and reuse them. | none |
| R-44 | Verifier inputs are unchecked | low | CONFIRMED | `src/plugins/verifier/index.ts:55,58,72,74` | `verifierOptions` is an undeclared field, `RunRecord` is cast without a check, and `../` in `model` or `lastRun` escapes the root. | Declare the field, validate the run record, and confine the paths to the root or `attachments/`. | none |
| R-45 | `triage` packs four subcommands into one `run` | low | CONFIRMED | `src/plugins/triage/index.ts:100-143` | Hand-rolled dispatch, and the usage string is repeated in 8 commands. | Split into separate commands (or a `subcommands` table), and add a `usageError(cmd)` helper. | none |
| R-46 | Quadratic grouping by array spread | low | CONFIRMED | `src/core/base.ts:202`, `src/core/check.ts:109`, `src/plugins/gates/index.ts:106` | O(n²) per group. | A push-based `groupBy` helper. | none |
| R-47 | `init` prints `naima new todos` | low | CONFIRMED | `src/core/cli.ts:113` | The core names a plugin type, and the hint is wrong without `todos`. | Print the first creatable type from the registry. | none |
| R-48 | The registry and config are mutable at run time | low | CONFIRMED | `src/core/types.ts:214-227`, `src/core/context.ts:26-47` | Any plugin can delete another plugin's command. | `Object.freeze` plus `ReadonlyMap` after `buildRegistry`. The full capability scoping is part of D-10. | none |

---

## 4. Strengths

- A small core (about 2,050 lines) with no dependencies, which runs on Deno, Node and Bun. Its own contributions go through the same plugin contract (`corePlugin`).
- Strict TypeScript with every strictness flag on, zero `any` and zero unused code.
- Subprocesses are always called with argument arrays, never through a shell.
- A published, versioned data format, with pure, deterministic, forward-only migrations and a one-format check.
- Documentation is part of each plugin's manifest and is enforced, and the reference is generated and held current by `verify`.
- Collisions are load errors, not silent overrides.
- Derived state (boards, gates, inverse links) is never stored.
- Cooperation by declaration already works where it was applied: the `proves` status flag, gates found in the registry, and rank terms summed.
- Honest tests: the real CLI against real git repositories on three runtimes, including the refusal paths and the permission fence. Item-level scans scale: 3,000 items give `check` in 0.5 s.
- The lock-and-relaunch design means everyone runs the same Naima, which is a sound base for pinning plugins (D-10).
