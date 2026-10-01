# The install workflow passes on Ubuntu, macOS and Windows

## The gesture

Push the branch; on GitHub, the `install` workflow
(`.github/workflows/install.yml`) runs the installers against a dist built in
the runner: `install.sh` on ubuntu-latest and macos-latest, `install.ps1` on
windows-latest. Each job: a fresh install ends with `all invariants hold`, no
`*.test.ts` and no `naima-tracker/` in the program, a rerun says `already
installed`, and a run outside a repository refuses with `not a git
repository`. On Windows, also the piped form (`Get-Content | Invoke-Expression`).

Pass: the three jobs green, with the run's link here.

## Measured so far

macOS, this machine, against a local dist: fresh (exit 0), rerun (exit 0,
"already installed"), outside a repository (exit 1), piped through `sh`
(exit 0), Deno missing with `NAIMA_NO_DENO_INSTALL` (exit 1, prints Deno's
installer), Deno missing without it (Deno installed into a scratch `HOME`,
then exit 0). The same three cases run in `src/site.test.ts` on Deno, Node
and Bun. Windows: not run anywhere yet — no PowerShell on this machine, and
Naima itself has never been exercised on Windows (docs/install.md, other
runtimes).
