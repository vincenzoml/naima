# Non-software pack: a paper's sections and reviews

Follow-up to `features/non-software-item-type-packs-experiments-analyses`,
whose Done criterion asked for one worked example of a non-software
item-type pack, naming `pack-analyses` (shipped) or this one — not both.
This is the other: a section of a paper, and a co-author's review of it, as
item types.

Done: a plugin, following `pack-analyses`'s shape (one or two types, reusing
`tests`/`verifies` rather than inventing new proof machinery), with a
`sections` type (a section of the paper, done when its text matches what the
outline agreed) and a way to record a co-author's review of one — a comment
thread, or a `tests`-like item whose evidence is the review itself, proven
when the reviewer's objections are answered rather than by running anything.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/f-u7-paper-pack

Shipped pack-papers: sections and reviews types, reusing verifies/verified-by like pack-analyses. Guide page naima/docs/guide/paper-sections-and-reviews.md; red-then-green suite tests/pack-papers-red-then-green-suite-passes passed; gates (deno task verify, node --test, bun test) green. fixedOn/commits/docs set; status left for the evidence owner to close.
