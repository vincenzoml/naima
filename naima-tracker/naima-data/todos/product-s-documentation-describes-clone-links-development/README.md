# The product's documentation describes the clone, and links development pages in naima-dev

Part of the epic "Product repo is the install; development in naima-dev"
(section "Docs, skill, guide").

## Definition of done

- [ ] `docs/guide/install.md`: the clone, data discovery, self-init, the lock as
  git, alignment, update, offline; "The copy", the per-user cache and "How the
  program is carried" gone; "The host's own tools" kept (the clone holds the
  same runtime files).
- [ ] `docs/guide/update-naima.md`, `docs/guide/tracker-folder.md`,
  `docs/reference/format.md` (no `carry`, the lock), `docs/README.md`,
  `docs/planned.md`, `README.md`, `skills/naima/SKILL.md` state what is.
- [ ] Every link to `develop/` is
  `https://github.com/vincenzoml/naima-dev/blob/main/develop/...`
  (`docs/README.md`, `docs/purpose.md`, `docs/reference/plugin-contract.md`).
- [ ] `docs/agents/release.md`: a version tag goes on the product repository.
- [ ] A host's migration from a copy is one short section: rerun the installer.
- [ ] The link test checks absolute `naima-dev` links against the workshop's
  own files.

## Files

The files above under `naima/docs/`, `naima/README.md`,
`naima/skills/naima/SKILL.md`; `test/docs-pages.test.ts`. Not
`naima/docs/reference/reference.md` (unit 1 regenerates it).

Sequential: after unit 1, in parallel with units 2, 3, 4.

## Proving gesture

`deno task verify` green (link and docs-pages tests), and `grep -rn
"naima-copy\|NAIMA_CACHE\|carry \|dist branch" naima/docs naima/skills
naima/README.md` returns nothing.
