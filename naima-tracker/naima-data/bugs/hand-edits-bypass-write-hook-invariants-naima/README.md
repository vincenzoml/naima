# Hand edits bypass write-hook invariants; `naima check` must re-assert them

Invariants held only by write hooks (a property holds only through a run; no closing one's own claims) are not re-asserted by `naima check`, so a hand edit of `meta.json` escapes them.

Done: each write hook that protects an invariant gets a check counterpart; a test edits `meta.json` by hand and sees `naima check` fail.
