# Writing a paper: sections and reviews

`pack-analyses` ([Extending Naima](extending-naima.md)) proves a non-software
step by rerunning a command. A paper has steps with no command to rerun at
all: a section is done when its prose matches what the outline agreed, and
that is a co-author's judgement, not a diff. `pack-papers` is the second
worked example of a non-software item-type pack, built for exactly that.

Opt in:

```json
"plugins": { "pack-papers": {} }
```

Two types:

- **`sections`** — one section of the paper. Starts `proposed`.
- **`reviews`** — a co-author's pass over one section. Starts `open`, raising
  objections; it ends `answered` (every objection addressed: the section
  matches the outline) or `standing` (at least one objection was never
  addressed — the reviewer says it still does not match).

A review proves or refutes a section exactly the way a test proves or
refutes a requirement — linked the same relation, `verifies`/`verified-by` —
except the proof is a reviewer reading the prose, never a program running:

```sh
naima new sections "Related work"
naima new reviews "Laura reviews related work" --set reviewer="Laura"
naima link <the review> verifies <the section>
naima set <the review> status=answered       # every objection addressed
naima set <the section> status=confirmed
```

`naima check` notes a section marked `confirmed` with no review that
answered it, and a section already matching its outline that is still
`proposed` — the same two notes `pack-analyses` gives a data-analysis step,
reusing the same proof machinery rather than a parallel one. If a review
later finds an objection still standing, set it `status=standing`: the check
says which section to move back to `disputed`.

Source: [`naima/src/plugins/pack-papers/index.ts`](https://github.com/vincenzoml/naima/blob/main/naima/src/plugins/pack-papers/index.ts).
