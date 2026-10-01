# Document Naima's purpose, requirements and philosophy

## The gap

`docs/` explains what Naima *is* and how each piece works — `concepts.md`,
`format.md`, `architecture.md`, the generated `reference.md` — but no single
page says why it exists, whom it serves, what it requires of itself, or the
principles behind its design. That material exists today only scattered
across:

- `README.md`'s "Why the name" and "What it is" sections (the pedal-point
  architecture metaphor, the plain-files-and-checks model, agents as a first
  audience);
- `docs/concepts.md` (what an item, a board, a gate *are*, implicitly
  assuming why they are shaped that way);
- `docs/architecture.md` (the dependency rule — "the core does not move" —
  stated as a rule, not tied back to the requirement it serves);
- the paper draft in `/Users/vincenzo/data/local/repos/papers/naima-paper`
  (read-only source material: its LaTeX sections likely motivate the design
  in a way none of the shipped docs currently do — not reviewed in detail as
  part of filing this item).

A reader who wants "why plain files, not a database", "why a small
never-moving core", "why agent-first", "why offline", "why fork-friendly, not
a hosted service" today has to reconstruct it from a name's etymology and a
handful of implementation pages.

## Done

A new docs page (for example `docs/purpose.md`) that states:

- **Why Naima exists and whom it serves** — a tracker for software built by
  people and agents together, treating proofs and formal properties the same
  way as tests.
- **Requirements**, functional and non-functional, each one **traceable to
  the code or check that enforces it** — not just asserted prose. For
  example: plain files (`docs/format.md`'s item-as-directory layout); no
  runtime dependencies (`deno.json`'s zero third-party imports); extensible
  forever (the plugin contract, `docs/plugin-contract.md`); agent-first
  (AGENTS.md's modes, `docs/flows/*`); offline (no run other than `naima
  update` asking the network, per `docs/install.md`); fork-friendly (the
  format is the compatibility boundary, `docs/format.md`'s opening
  paragraph).
- **Design principles and their rationale** — for example "the core does not
  move" (`docs/architecture.md`'s dependency rule) tied explicitly back to
  the requirement it serves (extensibility without forking).
- **Non-goals** — what Naima deliberately does not try to be (e.g. not a
  general project-management tool, not a hosted service, not a database).
- **The owner's decisions from the 2026-09-30 consolidated review**
  (`DECISIONS.md`, attached to the item "Consolidated review 2026-09-30" and
  to each `D-01`..`D-15` feature item this review filed) recorded here as
  principles where they state a durable design stance rather than a
  one-off implementation choice — for example data-only extension with no
  inheritance (decision D-04), or the fixed on-disk layout as the
  compatibility boundary between forks (decision D-03's recommendation).

The page is linked **first** from both `docs/README.md` and the project
`README.md`, ahead of the other docs pages, since it is meant to be read
before them.

## Not part of this item

Writing the page itself. This item is filing only, per the request that
raised it; implementation waits for the owner's go, per AGENTS.md rule 3.
