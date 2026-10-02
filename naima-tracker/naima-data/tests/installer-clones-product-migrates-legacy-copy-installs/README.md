# Installer clones the product, migrates a legacy copy, and installs a tagged release

The gesture that proves it, step by step, and what a pass looks like.

Run `node --test test/site.test.ts` (also green under `deno test -A test/` and
`bun test ./test/`). Three of its cases perform the installer for real, each
from a local fixture product on this disk (`NAIMA_SOURCE=file://…`, no
network):

- **Fresh install, rerun, refused outside a repository.** `site/install.sh`
  clones the fixture into a fresh project's `naima-tracker/naima`, runs
  `naima init` and `naima check` — the program is exactly the product's
  files, gitignored, `core.autocrlf=false`. Run again: it says "already
  installed" and checks again. Outside a git repository: refused with
  today's message, nothing written.
- **A tagged release.** `NAIMA_REF=v1.0.0` installs the tag's commit, even
  once the fixture's `main` has moved past it — the program's `HEAD` is the
  tag, not the branch tip. This is the gesture for
  bugs/installing-tagged-release-naima-ref-v1-0.
- **A legacy copy migrates.** A fresh install's clone is turned into the
  pre-clone-era shape (its `.git` removed, `.naima-copy.json` dropped in) and
  the fixture's `main` is advanced. Rerunning `install.sh` prints "moving it
  to naima-tracker/.naima-legacy-…", clones the product fresh, runs `naima
  update` (which moves the lock to the new head) and `naima check`, and
  prints the one commit to make. The legacy folder is left untouched, once,
  for the owner to look at.

## Result

Seen passing: `node --test test/site.test.ts` — 9/9, including the three
installer cases above (see attachments/node-test.txt). Also green under
`deno test -A test/` (388/388) and `bun test ./test/` as part of `deno task
verify`.

No red run is on file for the tagged-release case: the fixture passed the
first time it was run against this branch's `naima/src`, so the bug
(bugs/installing-tagged-release-naima-ref-v1-0) was not reproduced here —
whatever caused it elsewhere is not visible in this code. The test stays
linked as the gesture that would have caught it.
