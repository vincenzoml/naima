# Epics, milestones and gate commands pass on Deno, Node and Bun

Run `test/plugins/epics/epics.test.ts` and `test/plugins/gates/milestones.test.ts`
on Deno (`deno task test`), Node (`node --test`) and Bun (`bun test`).
They were red before the implementation and are green after it: derived epic
status, refusal to set it against its items, progress with blockers and
hands, a gate on an epic standing for its items, part-of to a non-epic,
days left / overdue in gates and queue, the overdue check, due and version
validation, gate new writing naima.json validated, gate add/remove through
the write hooks, gate show.
