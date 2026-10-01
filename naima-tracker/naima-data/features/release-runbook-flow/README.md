# Release runbook flow

An external build cannot be recalled; nothing today stages a release, stops on issues found, or records a trace.

Done: a flow page states stages — pre-release checks, private draft, test the artifact not the code, 'issues found -> stop' that loops back, publish, post-release checks, announce only what is true, rollback; every check derives its expected value from the repo; a trace item (or a `release` type) opens at stage 0; a check refuses to mark it done unless every stage's output is pasted in and every skipped stage names who decided; whoever wrote the code does not judge the gate.
