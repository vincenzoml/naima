# Epics, milestones and gate commands pass on Deno, Node and Bun

Run `test/plugins/epics/epics.test.ts` and `test/plugins/gates/milestones.test.ts`
on Deno (`deno task test`), Node (`node --test`) and Bun (`bun test`).
They were red before the implementation and are green after it: derived epic
status, refusal to set it against its items, progress with blockers and
hands, a gate on an epic standing for its items, part-of to a non-epic,
days left / overdue in gates and queue, the overdue check, due and version
validation, gate new writing naima.json validated, gate add/remove through
the write hooks, gate show.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
