# Timeline view: derived events, undated counted, records, ui tab

Proves the derived timeline (`naima view timeline`) by gesture.

## Gesture

```sh
deno test -A test/plugins/coordination/timeline.test.ts   # then node --test and bun test on the whole suite
```

`test/plugins/coordination/timeline.test.ts` pins: a gate opened on its first item's `created`, passed on its last item's `closedOn` or `fixedOn` once none is open; an epic opened from its members, not finished while one is open; a version tag is a release dated by its commit, a tag naming no version is not; a session is its note; a record written by `naima event` is one file in `events/` and an event; an invalid date is refused; a gate resolved with no date is counted at the foot, not placed; the text, JSON and the `naima ui` tab agree; without gates or epics loaded, releases, sessions and records still show.

Must appear: red before the view exists; green on Deno, Node and Bun.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u21-derived-views

Ran this session: red, both new suites failed (no command event; no command coverage, configuration refused). Green: deno task verify 336 passed 0 failed 1 ignored; node --test exit 0; bun test 336 pass 0 fail. Not verified: the naima ui tabs were rendered by the test, not opened in a window.
