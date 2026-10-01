# naima adopt suite: markers only add, byte-for-byte round trip, re-run, audit, evidence-only links

Proves adopting an existing board without loss (`naima adopt`) by gesture.

## Gesture

```sh
deno test -A test/plugins/adopt    # then node --test and bun test on the whole suite
```

`test/plugins/adopt/adopt.test.ts`, on the fixture `test/plugins/adopt/fixtures/TODO.md`, pins: `propose` as a dry run leaves the file alone; with `--write` the file's diff deletes zero lines (`git diff --numstat`), and stripping the markers gives the fixture back byte for byte; a ticked checkbox is proposed `status=done`, a "Bug:" line as `bugs`; a list item at the end of a file with no final newline gets no closing marker. `split` as a dry run opens nothing; with `--write` one item per marker, each page the segment byte for byte, `section` the nearest heading, `adoptedFrom` naming the lines and the commit, and the record's pieces join to the original exactly; `naima check` has no problem. A re-run proposes one marker for the one new list item, opens only it, reports the reworded segment and does not overwrite the item a person edited; a third run opens none. `audit` reads every committed version and reports a todo dropped in an earlier commit with that commit and line, exits 1, then 0 once the line is carried into an item, and reports a list item added to the working tree. `links` proposes `relates-to` only for two items naming the same real commit with shared title wording; a shared commit alone, shared wording alone and a fenced `sh` command (a gate candidate) are printed for a person; a hash that is no commit is ignored; `--write` writes the one proposed link only. Refusals: split before markers, a path outside the project, a missing file, an unknown subcommand; the source is never removed.

Must appear: red before the plugin exists; green on Deno, Node and Bun.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u20-adopt-boards

Ran this session: red, the new suite failed to type-check (the adopt module absent). Green: deno task verify 337 passed 0 failed 1 ignored; node --test 337 pass 0 fail 1 skipped; bun test 337 pass 0 fail 1 skip. Dry run on naima/docs/planned.md: 14 markers proposed, 0 lines deleted; audit read 15 versions from git. Not verified: a real adoption written on a real project's board; a board with CRLF line endings (handled in code, no fixture).
