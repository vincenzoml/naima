# Fresh naima init fails on Windows: git's forward-slash toplevel never matched real()'s backslash path

## Where

`naima/src/core/cli.ts`, `runningCommit()`.

## What is wrong (the failure)

`.github/workflows/install.yml`'s `install` job passes on ubuntu-latest and
macos-latest but fails on windows-latest, at install.ps1's fresh install:
`naima init` refuses with "this Naima is not a clone with an origin", even
though the clone does have one.

`runningCommit()` decided whether the running Naima is its own clone by
comparing `toplevel(programRoot)` — git's `--show-toplevel`, always
forward-slash, even on Windows — directly against `real(programRoot)`
(`node:fs` `realpathSync`, native separator: backslash on Windows). The two
never compared equal there, so a fresh Windows clone was never recognized as
its own clone, `commit` stayed null, and init refused.

## The fix

Added `nativePath()` in `naima/src/core/git.ts` (the inverse of the existing
`gitPath()`): turns a path git printed into the given platform's own
separator. `runningCommit()` now normalizes git's toplevel through it before
comparing to `real()`.

## Evidence

Measured: `.github/workflows/install.yml`'s `install (windows-latest)` job
log, captured before the fix, shows the exact refusal above at `naima
init`'s own line. Regression test: `test/git.test.ts`, run on every runtime
(it simulates the Windows separator, so the case is exercised without a
Windows filesystem).

## Done

`install (windows-latest)` job green on a push of the fix — see
tests/install-workflow-passes-ubuntu-macos-windows.

## Notes

### 2026-10-01 — evidence owner, on claude/evidence-close-6

Evidence review (final pass): confirmed still unproven end-to-end. tests/nativepath-turns-git-s-forward-slash-toplevel is a sound unit-level regression test (red/green) but only simulates the Windows separator; tests/install-workflow-passes-ubuntu-macos-windows (the CI proof the item's own 'Done' section cites) is withdrawn — CI was removed; tests/install-ps1-installs-naima-windows-machine-fresh (the real gesture) is still open, runBy=human. Not closing: Windows install remains unverified on a real machine.
