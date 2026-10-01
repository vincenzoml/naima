# Bootstrap policy: the development version is managed by the previous pinned stable version

Naima tracks itself. Today the tracker is read by the code in the same
working tree (`npm run naima`), so a bug in the checker can hide a bug on the
board, and a change to the item format can make its own history unreadable.

The policy to decide and write down:

- the tracker is managed by the previous stable release, pinned by version in
  `devDependencies`, not by the working tree;
- the working tree's own build runs against the tracker as a test, never as
  the authority;
- a format change ships with the stable release that can read it before the
  development version is allowed to write it.

- [x] decide the pin mechanism: a git tag, named by `naimaStable` in
  `package.json`, extracted with `git archive` into `.naima/stable/<tag>-<commit>/`
  and run by node directly (no runtime dependencies, TypeScript run as is)
- [x] switch `npm run naima` to the pinned version: `v0.1.0`, tagged at
  7405111; `npm run naima:dev` runs the working tree; `npm run verify` checks
  with both; `npm run stable:bump -- <tag>` moves the pin only when the new
  tag passes `check` on the tracker

Written down in `docs/bootstrap.md`.

## Evidence

`attachments/stable-run-2026-09-29.txt`: the pin resolves to the tagged
commit, and `src/stable.test.ts` passes — in a throwaway repository, a change
to the working tree's CLI is not seen by `npm run naima`, a bump to a tag
that fails `check` is refused with the pin unchanged, and a bump to one that
passes moves it. Proof owed: `tests/tracker-managed-by-pinned-stable-not-working`.
