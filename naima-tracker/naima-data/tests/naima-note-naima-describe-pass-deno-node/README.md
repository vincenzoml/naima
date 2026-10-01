# naima note and naima describe pass on Deno, Node and Bun

Run `test/core/notes.test.ts` on Deno (`deno task test`), Node (`node --test`) and Bun (`bun test`).
It was red before the implementation (the commands and `saveProse` did not exist) and is green after it:
a dated, attributed note appended after earlier ones; text from `--file`; an empty text or a heading refused
with exit code 2 or an error; the author from `--by`, else git's user.name, else refused; the description
replaced with the title and Notes section kept; a title line or Notes heading in a description refused;
a prose write through the write hooks, a refusal leaving the README as it was, and the Notes section append-only.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
