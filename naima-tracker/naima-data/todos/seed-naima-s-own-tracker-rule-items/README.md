# Seed Naima's own tracker with rule items, each with its reason

Naima now has a `rules` type with a reason, an audience, a strength and `enforcedBy`, shown by `naima rules` — but Naima's own tracker holds no rule items yet; the mechanism exists, the content does not.

Done: the project's working modes (quiet, simple, fast, reporting, irreversible actions) and the rules already named in AGENTS.md are filed as `rules` items via `naima new rules`, each with its reason, until the lock moves to a commit carrying the `rules` plugin per bootstrap.md; `naima rules --audience agents` then shows them.
