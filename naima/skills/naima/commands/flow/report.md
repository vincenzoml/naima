---
description: Route what was said, seen or found · to its tracker, triaged
argument-hint: [what was said]
---
$ARGUMENTS

Flow: [reporting and triage](../../../../docs/agents/reporting-and-triage.md) —
it owns the routing table.

1. **Write it before you understand it**: `naima new <type> "<what happened>"`.
   Broken → `bugs`; work → `todos`; wanted → `features`; to be tried → `tests`.
2. **The page carries**: what happened, in your own words (the owner's words or
   files only with their yes), the evidence, measured apart from
   inferred, the consequence. Write it with `naima describe <item> "<text>"`
   and record what you checked with `naima note <item> "<text>" --by <who>`;
   never edit `README.md` by hand.
3. **Triage it now**: `naima triage set <item> impact=… priority=… confidence=…`.
   `effort` only if you have looked at the code.
4. **Link, don't repeat**: `naima link <a> <relation> <b>`.
5. `naima check`.

"I already told you" means it was lost: write it now and say it was missing.
