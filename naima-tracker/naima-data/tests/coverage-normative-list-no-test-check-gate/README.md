# Coverage of a normative list: NO TEST, --check, gate, ui tab

Proves coverage of a normative list (`naima coverage`) by gesture.

## Gesture

```sh
deno test -A test/plugins/gates/coverage.test.ts   # then node --test and bun test on the whole suite
```

`test/plugins/gates/coverage.test.ts` pins: a JSON source (file, dotted path with `*`, objects named by `id`) and a files source (patterns, a regex's first group) yield the entries in order; each entry printed with the proving item that `covers` it, or NO TEST; a non-proving item covers nothing; `<list>:<entry>` scopes a value to one list; `--check` exits 1 on NO TEST and 0 once covered; a new entry in the source shows at once (read every run, never copied); `--json` gives the data; the `naima ui` tab marks NO TEST; a gate with `coverage` is blocked by each NO TEST, by name, and holds once covered; `gate new --coverage` is validated against the declared lists and written; an unreadable source is a check problem, a `covers` value its list no longer holds a note; a list with two sources, a files list with no pattern, a bad regex, and a gate naming no list are refused at load.

Must appear: red before the command exists; green on Deno, Node and Bun.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u21-derived-views

Ran this session: red, both new suites failed (no command event; no command coverage, configuration refused). Green: deno task verify 336 passed 0 failed 1 ignored; node --test exit 0; bun test 336 pass 0 fail. Not verified: the naima ui tabs were rendered by the test, not opened in a window.
