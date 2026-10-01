# Surface how long a now-priority item has sat unclaimed

Found reviewing `naima-tracker/naima-data/todos/review-reporting-triage-sequence-against-industry-practice`:
industry triage (ITIL, most bug trackers) surfaces age against priority, so a
`now` item sitting unclaimed for days is visible without anyone asking. Naima's
`naima queue` and `naima triage` show *whose hands* an item needs, never *how
long* it has waited there.

Done: a view, or a column on an existing one, shows how long an item has sat
at its current priority with no claim (since `triagedOn`, or since priority
last changed if that is tracked) and a check or note flags a `now` item open
past a configurable age with nobody holding it.

## Notes

### 2026-10-01 — claude, on claude/f-u2-age

Implemented: naima view next carries an age column (days since triagedOn, or created) and marks an unclaimed now item; added check unclaimed-now-item-aging (options.maxNowAgeDays, default 3). Proven by tests/view-next-s-age-column-unclaimed-now. Gates green: deno task verify, node --test, bun test --timeout 30000.
