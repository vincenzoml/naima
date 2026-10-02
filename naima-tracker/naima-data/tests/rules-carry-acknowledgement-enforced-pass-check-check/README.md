# rules carry an acknowledgement, enforced in pass, check and check-ack

The gesture that proves it, step by step, and what a pass looks like.

```sh
node --test test/plugins/rules/rules.test.ts test/plugins/coordination/coordination.test.ts
```

- `rules.test.ts`: a rule's `ack` field is printed with it, `naima rules`
  ends with the joined `Acknowledge: ...` line, and `naima rules check-ack
  <file>` names what a reply is missing, exits 1 until every phrase is
  present, then exits 0.
- `coordination.test.ts`: `naima pass --ack "<line>"` refuses a line missing
  a phrase the active rules ask for, and otherwise writes it first in the
  note; `naima pass` on its own never demands one; `naima check` reports a
  session note dated on or after the cut-off with no acknowledgement, or
  whose body no longer starts with it, as a problem — and leaves an older
  note alone.

Red, then green: before the feature, `coordination.test.ts` had no `--ack`
option (an unrecognized flag) and `rules.test.ts` had no `ack` field, `ack`
in its JSON, or `check-ack` subcommand — every assertion above referencing
them failed, or the flag/subcommand itself did not exist. After the feature,
both files pass in full.

## Result

Run locally, 2026-10-02: both files green, 18 tests, 0 failures (see the
session note for the gate numbers). Evidence kept: the test run's own output,
read directly rather than claimed.
