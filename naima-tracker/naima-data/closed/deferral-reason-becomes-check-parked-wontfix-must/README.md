# Deferral-with-reason becomes a check (`parked`/`wontfix` must say why)

`parked` and `wontfix` can currently be silent.

Done: reporting-and-triage gains the 'capture now, act later' and 'I already told you' steps, as a top-level, always-on agent behaviour (naima/skills/naima/SKILL.md, naima/docs/agents/reporting-and-triage.md), with a project rule (rules/capture-now-act-later-always) and a `naima new --dedupe` helper that hints likely duplicates before writing.

- [ ] both statuses checked like `partial` already is — a problem when the page gives no reason; extends naturally into the related item's `reopensWhen` field. Picked up by U13 (features/deferrals-name-what-reopens-them-list-which).

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: not a duplicate, but a subset of features/deferrals-name-what-reopens-them-list-which; one work unit (U13) covers both. Leaving status as-is for the evidence owner to judge.

### 2026-10-01 — Claude, capture-now agent, on claude/capture-now

Capture-now/act-later half done: the skill (naima/skills/naima/SKILL.md) now states filing at once as a top-level, always-on behaviour, not only on /flow:report; reporting-and-triage.md says the same; naima new --dedupe (naima/src/core/base.ts, naima/src/core/item.ts) prints likely duplicates of the same type before writing, and still writes; project rule filed as rules/capture-now-act-later-always. Proof: tests/capture-now-behaviour-new-dedupe-hints-duplicates (passed). Left for U13 (features/deferrals-name-what-reopens-them-list-which): the parked/wontfix-must-say-why check itself, and reopensWhen.
