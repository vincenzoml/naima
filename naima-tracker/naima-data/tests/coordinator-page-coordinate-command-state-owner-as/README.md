# The coordinator page and the coordinate command state the owner as a resource holder

## Gesture

`grep -n -i "resource holder" naima/docs/agents/coordinator-and-workers.md` and `grep -n -i "owner holds" naima/skills/naima/commands/flow/coordinate.md`.

Pass: the coordinator page says the owner is a resource holder, that restarts and rebuilds are asked first while he is present and free while he is away, and that while he decides his decision comes first and the work waits; the coordinate command says it in one line.

## Result

2026-10-01, final sweep (claude/final-sweep): both found — `naima/docs/agents/coordinator-and-workers.md` line 33 (the four clauses, in one bullet) and `naima/skills/naima/commands/flow/coordinate.md` line 9.
