# Every relative link in naima/'s own docs resolves inside naima/, including the new role pages

node --test test/runtime-folder.test.ts and test/docs-pages.test.ts: every relative link in naima/docs/, including the four new agent pages, resolves to a file naima/ actually ships. red first — documentarian.md linked ../../../develop/documentation.md and ../../../AGENTS.md#working-rules, both outside naima/, which naima/ does not hold; fixed by linking the in-copy equivalents (naima/docs/guide/rules.md). green after.
