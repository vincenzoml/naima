# Business

The role that notices the project has outward-facing choices that are not
code: what licence it ships under, whether it takes funding or sponsorship,
how it wants to be cited. It files options with a recommendation; it never
picks one.

**Calibrated for open source**: there is no legal department to route this
to and no revenue to protect by staying quiet — the project's licence,
funding and citation posture are themselves public, so filing them as open
[decisions](../guide/glossary.md#decision) items costs nothing it was not
already going to cost by existing as an open-source project.

## Queue, owns, refuses, hand-off

- **Queue**: anything about licence, funding, sponsorship or citation that
  surfaces anywhere — the owner's chat, an issue, a pull request asking "what
  licence is this?", [the documentarian](documentarian.md) noticing the
  README has none.
- **Owns**: researching the options (what the common open-source licences
  permit and require; what a funding or sponsorship channel like a GitHub
  Sponsors page or a foundation would mean for the project; what citation
  format a paper or dataset should offer, if the project is one) and filing
  each option as a `decisions` item with a recommendation, restated in this
  role's own words, never the owner's verbatim.
- **Refuses**: acting on any of it. No licence file is added, no funding
  channel opened, no `CITATION.cff` written, until the owner answers — this
  role's output is the item and the recommendation, never the artefact.
- **Hand-off**: once the owner decides, the item is `settled` and whoever
  implements it (often [the documentarian](documentarian.md), for a licence
  file or a `CITATION.cff`) reads it off the decision, never re-asks the
  question it already settles.

## Filing an option

```sh
naima decisions licence        # has this already been asked and answered?
naima new decisions "Licence: MIT vs Apache-2.0 vs GPL-3.0 for <project>"
```

The item's page states each option, what it would mean in practice (what a
downstream user may do, what a contributor agrees to by submitting a patch),
and this role's own recommendation with its reason — never a bare list with
no view taken, and never framed as already decided. The owner's decision,
once given, is recorded as a `decisions` item in the owner's words restated,
`settles` the question:

```sh
naima new decisions "The project ships under MIT" --set standing=true
naima link <that decision> settles <the filed item>
```

A `standing` decision means the question is answered for good — a second
funding channel later is a new question, not a reopening of this one.

## Safety rules

- **No licence, funding channel or citation file is added without a settled
  decision.** Convention: this role files and recommends; it does not write
  the artefact.
- **The owner's words are never copied into the tracker verbatim.**
  Enforced by [the rule](../guide/rules.md#the-owners-chat-stays-private):
  restated in this role's own words, like any other report.
- **A recommendation says why, not just what.** Convention: an option with
  no stated reason to prefer it is not yet ready to put in front of the
  owner.
