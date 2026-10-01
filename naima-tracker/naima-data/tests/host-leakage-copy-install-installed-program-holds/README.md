# Host leakage, copy-on-install: an installed program holds no test, tracker item or agent rule, though its source holds all three (test/runtime-folder.test.ts, on Deno, Node and Bun)

## Gesture

`deno test -A test/runtime-folder.test.ts --filter "host leakage"`, then the full suite under Node and Bun. The test builds a source holding all of Naima's repository — its tests, `AGENTS.md`, `CLAUDE.md` and tracker items, asserted present (the negative half) — installs a fresh git project from it with `naima init` (copy-on-install: `copyProgram()` in `naima/src/core/program.ts` checks out only `naima/` of the locked commit), and reads the installed `naima-tracker/naima/` off the disk:

- no `*.test.ts`, `testing.ts`, `test/`, `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/`, tracker item or `naima-tracker/` in it;
- exactly `naima/`'s files plus the copy record `.naima-copy.json`, and no `.git`;
- an item the host files lands in the host's own `naima-tracker/naima-data/tests/`, and the program directory is unchanged.

Pass: green on all three runtimes.

## Result

2026-10-01, final sweep (claude/final-sweep). Red: with `copyProgram()` reading the whole commit's tree instead of `naima/` only, the test fails on Deno, listing the tracker items it finds in the program directory. Green: restored, it passes on Deno, Node and Bun (the full gates of the sweep).
