# `specs` type, versioned, with a spec-first loop

The routing table has no home for 'the behaviour must be Z'. An earlier reading treated this as a minor routing gap; an audit of a comparable method found 49 versioned spec files there with 167 commits to them in 30 days — daily practice, not minor, so this item's priority is raised accordingly.

Done: a `specs` type (or a configured path) holds versioned specifications (`name-vN`); the open flow checks the spec before building and proposes a spec change first; the close flow confirms the code matches it; the routing table names this destination; reporting-and-triage documents the spec-first step.
