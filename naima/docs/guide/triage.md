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

## Rewrite the description, note what you checked

Triage often rewrites a report so the next reader can act on it, and records
what was checked. Both are commands, so they are dated, attributed and
checked like every other write:

```sh
naima describe export-drops "Export to PNG loses the alpha channel on 16-bit images."
naima note export-drops "Reproduced with sample.png; 8-bit images keep alpha." --by "Ada"
```

`naima describe` replaces the description and keeps the title and the notes.
`naima note` adds a dated entry, with its author and branch, at the end of the
item's **Notes** section; earlier notes are never rewritten. Both read a
longer text from `--file`. Write in your own words: a person's message goes
in verbatim only with their yes ([the rule](rules.md#the-owners-chat-stays-private)).

## See what is missing

```console
$ naima triage
  type         open    priority     impact     effort confidence   derived
  bugs            1           0          0          0          0   0
  tests           1           0          0          0          0   0
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

## Deferring

A [deferral](glossary.md#deferral) — `priority=parked`, or a bug `wontfix` or
a todo `dropped` — is captured in full like any other item, then say what
would make it worth re-arguing:

```sh
naima triage set export-drops priority=parked reopensWhen="when the format gains an alpha channel in its spec"
```

```console
$ naima view parked
  [open] bugs/export-drops  Export to PNG loses the alpha channel — reopens when: when the format gains an alpha channel in its spec
```

An item left without `reopensWhen` is reported by `naima check`
(`deferred-says-why`): say why, and what would reopen it, before moving on.
Read `naima view parked` before filing something that looks familiar — the
answer may already be "I already told you".

## Authoritative documents

A project may declare which documents are authoritative for a kind of status,
and which are retired, in `naima-data/naima.json`:

```json
{ "plugins": { "triage": { "options": { "documents": {
  "naima/docs/planned.md": { "says": "what Naima does not do yet" },
  "OLD-STATUS.md": { "says": "superseded by planned.md", "retired": true }
} } } } }
```

`naima guide` prints the list first, so an agent reads which document to
trust, and which one not to start competing with, before anything else.

## Next

- Where the ranking shows up: [read the board, the queue and the gates](read-the-board.md).
