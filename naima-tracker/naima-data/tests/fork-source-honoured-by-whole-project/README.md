# A fork source is honoured by the whole project

## Gesture

Set `source` in `naima.json` to a fork of Naima, `commit` to a commit of the fork that adds a plugin, and `plugins` to that plugin's path in the fork; run the plugin's command.

Pass: it runs, printing the fork's output; the program directory is at the fork's commit with the fork as `origin`.

## Result

2026-09-30, the author (agent), automated by `src/distribution.test.ts` ("a fork source is honoured"): passes on Deno 2.9.7, Node 26.5.0 and Bun 1.4.2, 57 tests each — the feature's attachments `tests-deno-2026-09-30.txt`, `tests-node-2026-09-30.txt` and `tests-bun-2026-09-30.txt`, in `features/deno-distribution-one-global-install-naima-tracker/attachments/`. Not yet performed by someone other than the author.
