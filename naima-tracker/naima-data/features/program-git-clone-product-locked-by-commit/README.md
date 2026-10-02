# The program is a git clone of the product, locked by commit; copy, cache, carry and dist removed

Part of the epic "Product repo is the install; development in naima-dev": its
README is the design this unit implements (sections "Layout of a host",
"Removed", "Kept").

## Definition of done

- [ ] The launcher finds the data as `--data`, `NAIMA_DATA`, else
  `dirname(program)/naima-data`; the walk up from the current directory is gone.
- [ ] First run with no sibling `naima-data/`, inside a git work tree: creates it
  with `naima.json` (source = the clone's `origin`, credentials stripped;
  commit = the clone's `HEAD`, which must be on `origin/main`), plus the
  parent's `README.md` (with the two restore commands) and `.gitignore`
  (`/naima/`). Outside a work tree: refused with the installer's message.
  `naima init` does the same explicitly and keeps `--write-excludes` and
  `--write-agent-pointer` (pointer text: "Naima is in <parent>/ (naima/ the
  program, naima-data/ the data); if you find it elsewhere, update this line").
- [ ] Alignment: `commit` != clone `HEAD` → fetch from a local seed (the main
  worktree's program clone), else `origin`; detached checkout; relaunch (exit
  code 75). `naima update [--check | --accept-source]`: fetch `origin main`,
  checkout, migrate, record, one change to commit.
- [ ] `naima update` run from a product clone on a lock naming a legacy
  commit of the old layout (it holds `naima/src/cli.ts`; same repository,
  same history) moves it to the product head (the migration path the
  installer uses).
- [ ] Removed: `copyProgram`, `.naima-copy.json`, the manifest, `NAIMA_CACHE`
  and `cacheDir`, `.naima-fetch`, `naima carry` and `CARRY_MODES`, `distSource`
  and the dist branch code. A format migration drops `carry` from
  `naima.json`; a host whose `carry` was `vendored` or `submodule` is refused
  by `update` with one line saying how to remove it by hand.
- [ ] The test fixtures build a product-layout source repo from the files of
  `naima/` (`git -C naima ls-files`), so the tests pass before and after the
  split.
- [ ] `deno task docs` regenerated (the command list changed).

## Files (this unit owns them)

`naima/src/launcher.ts`, `naima/src/core/program.ts`, `layout.ts`, `config.ts`,
`lifecycle.ts`, `entry.ts`, `cli.ts`, `types.ts`, `migrations.ts`,
`internal.ts`, `pointer.ts`, `git.ts` (if a helper is needed),
`naima/docs/reference/reference.md` (generated); `test/distribution.test.ts`,
`test/launcher.test.ts`, `test/runtime-folder.test.ts`, `test/init.test.ts`,
`test/lifecycle.test.ts`, `test/cli.test.ts`, `test/core/lock.test.ts`,
`test/core/format.test.ts`, `test/core/testing.ts`, `test/core/core.test.ts`,
`test/core/files.test.ts`. `naima/src/core/excludes.ts` is kept untouched.

Sequential: first of the epic; units 2, 3 and 5 start after it is merged.

## Proving gesture

A new end-to-end test, on Deno, Node and Bun: a temporary host; `git clone`
the fixture product into `naima-tracker/naima`; `naima check` creates
`naima-data/`, `.gitignore` and `README.md`; a second clone of the host plus a
clone of the program at another commit aligns to the lock without the
network; a new product commit + `naima update` moves the lock in one commit; a
legacy copy lock migrates. Gate: `perl -e 'alarm 900; exec @ARGV' deno task
verify`, then `node --test` and `bun test` as `AGENTS.md` says.
