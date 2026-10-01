# naima move moves an item to another type, keeping its id and links, refusing a status or field the new type lacks (test/core/core.test.ts)

The gesture that proves it, step by step, and what a pass looks like.

## Result

What was seen, when, and by whom.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u8-papercuts

Result: pass. Gesture: test/core/core.test.ts exercises the new naima move <item> <type> [--force] command: keeps id and links; refuses a status the new type does not declare, or a known field that does not apply to it, unless --force; a usage error for a missing argument. Red before the command existed, green after adding it to naima/src/core/base.ts (uses the existing moveItem helper) and registering it on corePlugin.commands. Full suite: deno task verify, node --test (241/0), bun test (241/0).
