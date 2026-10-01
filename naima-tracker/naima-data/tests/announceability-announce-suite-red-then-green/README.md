# Announceability: announce suite red then green

Proves announceability computed from user-facing, shipped, documented and checked, by gesture.

## Gesture

```sh
deno test -A test/plugins/announce   # then node --test and bun test on the whole suite
```

`test/plugins/announce/announce.test.ts` pins: only a feature with facing=user, status shipped, docs set and a passed proof run by a person or end to end (runBy human or agent-hands) is announceable; a unit-tested-only, undocumented, unshipped or internal one is not, each saying what it lacks, and an internal one is never listed; major first, then most recently shipped; --since keeps by fixedOn, --gate by gate; a refuting proof outweighs a person's check; evidenceKind owner-gesture counts whoever ran it; the README naming a not-announceable feature by its full title, across a line break, fails copy-names-only-announceable.

Must appear: red before the plugin exists; green on Deno, Node and Bun.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u18-roles

Ran this session: red, both new suites failed to type-check with the plugin sources stashed (4 errors, modules absent). Green: deno task verify 337 passed 0 failed 1 ignored, naima check all invariants hold; node --test 338 tests 337 pass 0 fail; bun test 337 pass 0 fail.
