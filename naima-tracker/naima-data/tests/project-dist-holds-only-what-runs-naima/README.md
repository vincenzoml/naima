# A project on the dist holds only what runs Naima, in every worktree

## Gesture

Offline, from a checkout of Naima that has the change:

1. `deno test -A src/dist.test.ts` — every test passes: the allowlist
   (`dist.json`) ships 0 `*.test.ts`, 0 development files (`AGENTS.md`,
   `CLAUDE.md`, `.claude/`, `.github/`, `deno.json`, `package.json`,
   `scripts/`, `src/core/testing.ts`), 0 tracker items; every import and
   every relative markdown link of what ships resolves inside it; a host that
   clones the dist has exactly the allowlist on disk, in its main worktree
   and in a second one, and `init`, `check`, `guide`, `update` work.
2. The same file under Node and Bun: `node --test src/dist.test.ts`,
   `bun test src/dist.test.ts`.

Online, once the dist job has pushed `dist` (the half not yet performed):

3. In a fresh git repository: `git clone --branch dist
   https://github.com/vincenzoml/naima.git naima-tracker/naima`, then
   `deno run -A naima-tracker/naima/naima.ts init`.
4. `find naima-tracker/naima -name '*.test.ts' -o -name AGENTS.md -o -name
   .claude -o -name .github -o -name naima-tracker | wc -l` prints 0, and
   `git -C naima-tracker/naima log -1 --format=%B` carries a
   `Source-Commit:` trailer naming a commit of main.
5. Negative half: the same `find` in a clone of `main` prints more than 0.

Pass: all hold.

## Result

Steps 1–2 performed by the author on 2026-09-30 (Deno 2.9.7, Node 26.5.0,
Bun 1.4.2): pass. Steps 3–5 not performed: the dist branch does not exist
until CI runs on a pushed main.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
