# No new status or summary document — update the authoritative one

Never start a new status page, progress summary or "where things stand"
document. Find the authoritative one for the kind of status in question
(`naima guide` prints the list a project declares in
`plugins.triage.options.documents`) and update it in place; if none is
declared, the trackers themselves — `naima board`, `naima queue`,
`naima summary` — are authoritative.

Why: a parallel status document always drifts from the trackers. Once two
documents both claim to say where things stand, an agent plans from
whichever one it opened first, and the two keep being reconciled by hand
instead of read from one place. Retire a superseded document in the list
(`retired: true`) rather than leaving it to compete silently with the one
that replaced it.
