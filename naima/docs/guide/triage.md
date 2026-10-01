# Triage

[Triage](glossary.md#triage) ranks an [item](glossary.md#item) against everything else, so the
list "most urgent first" means something. Four fields; three are set when the
item is opened ([the rule](rules.md#triage-what-you-touch)).

## Set the fields

```sh
naima triage set export-drops impact=high priority=now confidence=measured
```

| Field | Ask yourself | Values |
|---|---|---|
| [impact](glossary.md#impact) | if nobody touches this, who notices? | `blocker` · `high` · `medium` · `low` |
| [priority](glossary.md#priority) | when? | `now` · `next` · `later` · `parked` |
| [confidence](glossary.md#confidence) | do we understand it? | `measured` · `diagnosed` · `reported` · `unclear` |
| [effort](glossary.md#effort) | what does the fix cost? | `S` · `M` · `L` · `XL` |

Set **effort** only once someone has looked at the code. A report says nothing
about what a fix costs, and an unsized item sinking in the ranking is the
honest outcome ([the rule](rules.md#effort-is-never-guessed)).

Every change to these fields stamps `triagedOn` with today's date.

## See what is missing

```console
$ naima triage
  type         open    priority    impact    effortconfidence   derived
  bugs            1           0         0         0         0   0
  tests           1           0         0         0         0   0
$ naima triage missing
2 open items without effort — the field only a person can set:
  tests/looks-right-phone  Looks right on a phone
  bugs/second-bug  Second bug
```

The first is coverage: per type, how many open items have each field. The
second lists what still lacks effort.

## Let Naima guess the rest

`naima triage derive` reads confidence off the words of each item's page, for
the items no person has triaged yet, and reports what it would set; `--write`
saves it, marked `triagedBy: derived`, so everyone can tell an inference from
a decision. A person's later change to any of the four fields drops the mark.
It never sets effort.

## The order it produces

`naima list --open`, `naima view next` and the "next up" block of
`naima summary` show open items most urgent first: impact, priority, effort
and the [gates](glossary.md#gate) an item is on, together. That order is
worked out each time, never stored.

## Next

- Where the ranking shows up: [read the board, the queue and the gates](read-the-board.md).
