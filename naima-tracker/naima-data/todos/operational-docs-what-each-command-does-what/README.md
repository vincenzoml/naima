# Operational docs: what each command does, what policies exist, how each is enforced

Documentation of how Naima operates is requested, not just how to invoke it.

Done: a docs page maps every command to what it does and the policy or invariant it enforces, if any; generated where possible from the manifests (`naima docs`) so it cannot drift; linked from the docs map.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/d2-people-docs

Partially met already: naima --help and naima docs (the generated reference) state what each command does and, for many, the invariant or policy it enforces (close: 'fixed, and proven by an item that has passed'; carry, update, etc.). A full command-to-policy map, generated so it cannot drift, belongs in naima/docs/reference/reference.md — outside this worktree's scope (naima/docs/guide/, README.md, planned.md only). Left open for whoever owns the reference generator (naima/src/plugins/docs).

### 2026-10-01 — Vincenzo Ciancia, on claude/f-u5-policy-map

Landed on claude/f-u5-policy-map (commit ab72b8d): commands carry an enforces field, filled for all 52; the documented check fails on one without it, so an outside plugin's command needs it too; the reference's Commands at a glance table has a What it enforces column, linked from naima/docs/README.md. Proof: tests/every-command-maps-what-enforces-reference.

### 2026-10-01 — Vincenzo Ciancia, on claude/f-u5-policy-map

Changed at e0824c5: enforces is optional in the plugin contract, so an outside plugin's command without it is a note in naima check, not a problem; first-party commands are held to it by test/plugins/docs/policy-map.test.ts. Proof tests/every-command-maps-what-enforces-reference passed.

### 2026-10-01 — Claude (implementer), on claude/big-policy-map

Verified on claude/big-policy-map: the policy-map work from ab72b8d/e0824c5 is already an ancestor of main and this branch. Re-ran deno task docs (no drift), deno task verify, node --test, and bun test — all green, including the two policy-map tests (every command maps to enforces; a plugin command without it is a note, not a problem). No code change needed; left for the trunk to close since this branch cannot close its own claim.
