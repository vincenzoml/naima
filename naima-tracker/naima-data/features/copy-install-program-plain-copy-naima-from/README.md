# Copy-on-install: the program is a plain copy of naima/ from a per-user cache, locked to a main commit; no dist branch

The owner's decision (2026-10-01): replace the generated `dist` branch with copy-on-install. The runtime lives in one folder, `naima/`, so the installer and the program itself fetch the source's `main` at the locked commit, shallow, into a per-user cache keyed by source (a commit present there is offline), and copy only the contents of `naima/` into the project's `naima-tracker/naima/` as plain files. The lock names that `main` commit; `naima update` moves it to main's head and copies again; a new worktree copies from the cache.

Carry: the default is a gitignored copy (`copy`, recorded by leaving `carry` out of naima.json); `vendored` is the same copy committed; `submodule` stays git's own. The gitignored clone mode goes: a clone of main would hold the whole repository. A lock naming a dist commit is mapped to the main commit of its `Source-Commit:` trailer and moves on the next `naima update`. `scripts/dist.ts`, the CI dist job and every dist-specific code path, test and page go; CI only tests.

## Notes

### 2026-10-01 — Claude, on claude/evidence-close-2

Evidence review (evidence-close-2): macOS/Linux copy-on-install is proven (tests/copy-install-end-end-program-exactly-naima, tests/install-sh-installs-into-temp-project-from, both passed). The Windows half is not: tests/install-ps1-installs-naima-windows-machine-fresh is still open and runBy=human (no Windows machine available to an agent), and tests/install-workflow-passes-ubuntu-macos-windows is withdrawn since the owner removed CI. Not closing: the claim covers every platform and the Windows gesture has not been performed.

### 2026-10-01 — evidence owner, on claude/evidence-close-6

Evidence review (final pass): confirms the prior evidence-close-2 finding still holds — macOS/Linux is proven (tests/copy-install-end-end-program-exactly-naima, tests/install-sh-installs-into-temp-project-from, both passed), Windows is not (tests/install-ps1-installs-naima-windows-machine-fresh open, runBy=human; tests/install-workflow-passes-ubuntu-macos-windows withdrawn). Not closing.
