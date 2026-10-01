# install.sh installs into a temp project from a local source on this Mac: fresh, again, and refusing outside a repository

On macOS, in a scratch folder: a non-local clone of the branch head as the source, its branch named main; a fresh `git init` project; `NAIMA_SOURCE` set to the source, `NAIMA_CACHE` and `TMPDIR` to scratch folders, `NAIMA_NO_DENO_INSTALL=1`. Run `sh site/install.sh` in the project: exit 0 with `all invariants hold`; naima-tracker/naima/ holds exactly the source's naima/ files plus `.naima-copy.json`, no `.git`, no `*.test.ts`, no `naima-tracker/`, no AGENTS.md or CLAUDE.md; the lock names the source's main commit; the temporary clone is gone. Run it again: exit 0, `already installed`. Run it outside a repository (`GIT_CEILING_DIRECTORIES` above it): exit 1, `not a git repository`.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/no-dist

Performed on this Mac at the branch head 01e40a5 (code unchanged since): fresh exit 0, all invariants hold; program = exactly the source's naima/ (diff empty) plus .naima-copy.json; 0 tests, no naima-tracker/, no AGENTS.md or CLAUDE.md, no .git; lock commit 01e40a5268bf = the source's main; the temporary folder empty after; again exit 0, already installed; outside exit 1, not a git repository. Logs fresh.log, again.log, out.log in the session scratchpad (gesture/).
