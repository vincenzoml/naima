# Runtime in one folder

The owner's decision: the repository's `naima/` folder holds the runtime and
only it, so a project's installed program (`naima-tracker/naima/` in a host)
is exactly the contents of that folder.

## Target layout

```
naima/          the runtime: naima.ts, src/ (no tests), skills/, docs/ (human and agent docs), LICENSE, NOTICE, README.md
test/           every test and test helper, mirroring the tree of naima/src/
scripts/ site/ naima-tracker/   development, website, Naima's own tracker
README.md LICENSE NOTICE AGENTS.md CLAUDE.md deno.json package.json   (the root holds nothing else)
```

## Done means

- The runtime allowlist (`dist.json`) is gone: the dist build
  (`scripts/dist.ts`) commits a plain copy of `naima/`, reproducibly, with the
  `Source-Commit` trailer kept.
- The dist branch stays the install source; the install page documents a
  partial clone of `naima/` as an alternative, not the default.
- Developer docs (architecture, plugin contract, documentation rule,
  bootstrap) live outside the runtime folder; the session note says where and
  why.
- Every path that names the old layout follows the move: `deno.json` tasks
  and includes, `package.json`, CI workflows, install scripts, `site/llms.txt`,
  the launcher and program code (a clone's entry point is `naima.ts` at its
  root), the dependency-rule test, docs links, `naima guide`, and the
  "Before pushing" commands in `AGENTS.md`.
- Renames are `git mv`; no logic changes beyond paths.
- `deno task verify` passes, and the tests pass on Node and Bun (baseline
  187 of 187).

## How it is proven

A tests item that `verifies` this one: a host install whose program
directory equals `naima/` exactly.
