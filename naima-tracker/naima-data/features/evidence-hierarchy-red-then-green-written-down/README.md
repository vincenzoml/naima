# Evidence hierarchy and red-then-green, written down

'Every claim carries evidence' is currently three slogans.

Done: concepts and rules state the ranking (the owner's own gesture, above a screenshot/log line/number, above a live state read by tooling, above before/after counts, above 'the code looks right', which proves nothing) and 'no number without its comparison'; tests gain an optional `evidenceKind` field from that ranking and a `redSeen` record for regression tests; a check notes a passed regression test with no red run; the evidence-owner role refers to the ranking.
