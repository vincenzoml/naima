# A lock source git would read as an option, or a relative path, is refused

## Gesture

1. `deno test -A src/core/lock.test.ts`: passes.
2. In a Naima project, set `"source": "--upload-pack=touch /tmp/pwned"` in
   `naima-tracker/naima-data/naima.json` and run `naima update --check`: it
   fails with `naima.json: source must not start with "-": git would read it
   as an option`, and `/tmp/pwned` does not exist.
3. Set `"source": "../naima"`: any command fails with `a path on this disk
   must be absolute`.
4. Negative half: `https://…`, `git@host:path`, `file:///…` and an absolute
   path are all accepted.

Pass: all four hold.

## Result

Step 1 performed by the author on 2026-09-30: pass. Steps 2–4 not performed
by hand.
