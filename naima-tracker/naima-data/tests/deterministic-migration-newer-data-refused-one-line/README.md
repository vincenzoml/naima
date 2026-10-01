# Deterministic migration; newer data refused in one line

## Gesture

Migrate two copies of the same format-1 data with the same migrations, and migrate one again; then write a newer format into `naima.json` and run any command.

Pass: the two outputs are byte-identical and the second migration changes nothing; a migration that throws leaves the data as it was; the command exits 2 with one line on stderr, `naima: naima.json is format N, newer than the format M this Naima reads — it was written by a newer Naima: record that Naima's commit`, and writes nothing; `check` fails on an item left in a replaced shape.

## Result

2026-09-30, the author (agent), automated by `src/core/format.test.ts` and `src/cli.test.ts` ("migration is forward only and deterministic"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.
