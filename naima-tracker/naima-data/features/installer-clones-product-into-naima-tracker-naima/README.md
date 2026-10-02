# The installer clones the product into naima-tracker/naima and migrates a legacy copy

Part of the epic "Product repo is the install; development in naima-dev"
(section "Installer").

## Definition of done

- [x] `site/install.sh` and `site/install.ps1`: find git; find the repository
  root, refuse outside one with today's message; install Deno if missing
  (`NAIMA_NO_DENO_INSTALL` kept); `git -c core.autocrlf=false clone
  --single-branch --branch $NAIMA_REF $NAIMA_SOURCE naima-tracker/naima`, with
  `core.autocrlf=false` kept in the clone's config; run `naima init
  --write-agent-pointer` from it; run `naima check`. No temporary clone.
- [x] `NAIMA_REF` may be a tag (fixes the open bug "installing a tagged
  release is refused").
- [x] Rerun on a host with a lock: clone at the locked commit if `naima/` is
  missing, then `check`.
- [x] Rerun on a legacy host (`naima/.naima-copy.json` present, or a clone
  whose `HEAD` holds `naima/src/cli.ts`): move it to
  `naima-tracker/.naima-legacy-<date>`, clone the product, `naima update`,
  `check`, and print the one commit to make.
- [x] The header comments describe the new steps.

## Files

`site/install.sh`, `site/install.ps1`, `test/site.test.ts` (its installer cases).

Sequential: after unit 1 (the program it runs).

## Proving gesture

`test/site.test.ts` installer cases on Deno, Node and Bun: fresh install,
rerun, refused outside a repository, tagged ref, legacy-copy migration — all
from a local fixture product (`NAIMA_SOURCE=file://…`): done, see
tests/installer-clones-product-migrates-legacy-copy-installs. A person runs
`install.ps1` on a Windows machine: fresh, again, refused outside a repository,
the piped form — still open, a human gesture no agent here can perform.
