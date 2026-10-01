# A naima outside the pin refuses in one line naming the version

## Gesture

In a git repository whose `naima/config.json` is `{ "naima": "^9.1.0" }`, run
any command with a Naima whose version is outside that range (`naima check`,
`naima new bugs x`).

Pass: exit 2, nothing on stdout, exactly one line on stderr naming the range
to use, and nothing written. `src/cli.test.ts` ("outside the pin") automates it.

## Result

2026-09-30, the author (agent), Naima 0.2.0 against `^9.1.0`: exit 2 and the
one line `naima: naima 0.2.0 does not manage this project: naima/config.json
pins naima ^9.1.0 — run npx naima@"^9.1.0"`.
`attachments/refusal-2026-09-30.txt`. Not yet performed by someone other
than the author.

## Withdrawn, 2026-09-30

The version pin it proves was removed: a project is locked to a commit, and data in another format is refused instead (the Deno distribution feature). Its successor is `tests/deterministic-migration-newer-data-refused-one-line`.
