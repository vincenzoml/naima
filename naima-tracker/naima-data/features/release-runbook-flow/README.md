# Release runbook flow

An external build cannot be recalled; nothing today stages a release, stops on issues found, or records a trace.

Done: a flow page states stages — pre-release checks, private draft, test the artifact not the code, 'issues found -> stop' that loops back, publish, post-release checks, announce only what is true, rollback; every check derives its expected value from the repo; a trace item (or a `release` type) opens at stage 0; a check refuses to mark it done unless every stage's output is pasted in and every skipped stage names who decided; whoever wrote the code does not judge the gate.

## Notes

### 2026-10-01 — implementer agent, on claude/u17-release

Fixed on commit e3c2300e4d76d597f88da8d7f564bc63347139a6 (claude/u17-release): releases type, release-stages hook/check/view in naima/src/plugins/planning/index.ts; naima/docs/agents/release.md.
