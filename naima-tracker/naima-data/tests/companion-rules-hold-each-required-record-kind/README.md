# Companion rules hold each required record kind in the staged commit: a link, a field, a note, an item of a type (test/plugins/hooks/hooks.test.ts, on Deno, Node and Bun)

Run `deno test -A test/plugins/hooks/`, `node --test test/plugins/hooks/hooks.test.ts` and `bun test ./test/plugins/hooks/`. One test per required-companion kind must fail without its record staged and pass once it is staged in the same commit: a verified-by link (the built-in fixed-has-test rule), a field (commits after fixedOn), a note on the page, a change to an item of a type (after a path rule). Also: nothing staged finds nothing, a field already committed does not retrigger, check --staged runs only the staged-change checks, and a malformed rule fails loading.

Result 2026-10-01: red first — with the rules neutered, the four companion-kind tests failed; restored, 10 of 10 passed on Deno, Node and Bun; full suites 303 of 303 each.
