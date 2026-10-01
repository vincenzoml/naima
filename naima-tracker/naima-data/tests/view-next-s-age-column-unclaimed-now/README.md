# View next's age column and unclaimed-now-item-aging check surface a now item nobody holds

View next's age column and unclaimed-now-item-aging check surface a now item nobody holds

## Gesture

```sh
node --test test/plugins/triage/triage.test.ts
```

Covers: `naima view next` carrying an age column derived from `triagedOn`
(or `created`); a `now` item no branch's claim names marked `unclaimed`; and
the check `unclaimed-now-item-aging` noting a `now` item open past
`options.maxNowAgeDays` with nobody's claim on it, silent on a claimed,
fresh, or non-`now` one.

## Result

All 14 cases in the file pass, `node --test`'s summary: `pass 14`, `fail 0`.
