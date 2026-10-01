# Reporting and triage

How something said, seen or found becomes an item someone can act on months
later, and how that item earns its place in the ranking.

## 1. Route it

Every sentence the owner says while using the software is one of a few
things, and each has one place. In the wrong place it is lost, and a lost
report has to be said again.

| When they say… | It goes in |
|---|---|
| "this is broken" | `bugs` |
| "this needs doing" — work, a decision, a tidy-up, not a defect | `todos` |
| "I'd like it to do X" — it does not exist | `features`, status `requested` |
| "this exists now" | `features`, status `shipped`, with its `docs` |
| "this still has to be tried" | `tests` |
| "the behaviour must be Z" | the project's specification |

A defect does not go in `todos`. A request is not a feature until the code
exists. If an earlier request is reversed, record the reversal — never
overwrite it.

## 2. Write it before you understand it

Open the item with what was observed, **then** investigate:

```sh
naima new bugs "<what happened, in one line>"
```

- A diagnosis that turns out wrong still leaves the observation, which was
  never wrong.
- An item opened late competes with whatever you are doing instead of being
  ranked against everything else.
- The report is evidence; your reconstruction is not.

The title says what happened, not what to do.

## 3. What a report carries

1. **The words, verbatim**, in the language they were said in — the phrasing
   carries what a paraphrase drops.
2. **The evidence**: a log line, a number, a command with its output, a file
   in `attachments/`. Evidence travels with the claim.
3. **What is measured and what is inferred, marked apart.** "Read in the
   code, certain" against what you checked; "not reproduced" against what you
   assume. An item that keeps the two apart stays useful even when its
   boldest claim turns out false.
4. **The consequence**: who notices, and when. Without it, `impact` is
   guessed, and a guessed impact makes the ranking lie.

Not a fix you have not tried, a cause you have not checked, or a severity
meant to get attention — attention is what `priority` is for.

## 4. Triage when you open it

```sh
naima triage set <item> impact=high priority=next confidence=reported
```

| Field | How to decide it |
|---|---|
| `impact` | if nobody touches this, who notices? `blocker` stops a release or loses work; `high` stops a user; `medium` is worked around; `low` only we would notice |
| `priority` | when: `now` · `next` · `later` · `parked` |
| `confidence` | do we understand it? `measured` · `diagnosed` · `reported` · `unclear` |
| `effort` | **never guessed.** Nothing in a report says what a fix costs; leave it empty until someone has looked at the code. An unsized item sinks in the ranking, which is the honest outcome |

**Triage what you touch**: opening, reporting or fixing an item means leaving
its fields set. `naima triage` prints coverage per type; do not add to what it
says is missing.

## 5. Cross-reference instead of repeating

Items name each other by permanent id (`naima link`), never by a slug in
prose:

- a test `verifies` the item it proves;
- a duplicate is `duplicate-of` its twin, and the twin keeps the evidence;
- an item that waits on another is `blocked-by` it.

## 6. Whose hands does the proof need

`runBy` says who can perform the gesture, by the instrument:

- `agent` — a command settles it: a unit test, a grep, an API call;
- `agent-hands` — an agent driving the running software settles it;
- `human` — only a person, and `humanBecause` says why
  ([asking the human](asking-the-human.md));
- `build` — an artefact nobody here makes.

Mark it with more care than any other field: it decides who picks the gesture
up, and both mistakes are expensive.

## 7. Closing

A fix is not a close. Closing takes the fix (`fixedOn`), the gesture that
proves it as an item linked `verifies`, and the gesture performed and passed —
then `naima close` moves the item to the archive, carrying its proof, so a
regression is recognised when it comes back. Fixed but unproven stays open:
the shape of a result is not its behaviour.

The proof must also be **current**. `naima close` refuses when:

- an item verifying it **refutes** it — a test that `failed`, a property
  that is `violated`: evidence against outweighs any evidence for;
- `naima check` finds a problem on an item verifying it — a property that
  holds on a model, property, verifier or options changed since its run. Run
  the gesture again (`naima verify`), then close.
