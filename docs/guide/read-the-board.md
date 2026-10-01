# Read the board, the queue and the gates

Every view below is [derived](glossary.md#derived): worked out from the items
when you ask, never stored, so it is never stale. Run any of them at any
time; none changes anything.

## Where the project stands

```sh
naima summary          # everything, one screen
naima bugs             # how many bugs are left
naima list --open      # every open item, most urgent first
naima board bugs       # one type, grouped by section
naima show <item>      # one item: fields, links both ways, attachments, page
```

`naima summary` has a block per plugin: item counts, bugs, what is next,
the gates, who is working on what ([claims](glossary.md#claim)) and where
the last sessions left off ([session notes](glossary.md#session-note)). With
`--markdown` it prints the same as markdown, to paste into a report.

## How many bugs are left

```console
$ naima bugs
bugs: 1 open
  unfixed (no code)     1
  fixed, not proven     0
  resolved, not closed  0
```

Three numbers, never added together. "How many are left" is the first:
unfixed. A fixed bug that nothing proves yet is a different number, and so is
one that is proven and only waits for `naima close`
([three states](rules.md#fixed-resolved-and-closed-are-three-states)).

## Boards

```sh
naima board bugs           # open items, by section
naima board bugs --all     # done ones too
```

A [section](glossary.md#section) is a heading you give items
(`naima new bugs "…" --section Export`), so a board reads like a plan.

## Gates

A [gate](glossary.md#gate) is what a release, or a merge, waits on. You
declare it once in the configuration, then put items on it.

1. Declare it in `naima-tracker/naima-data/naima.json`
   ([configure the project](configure-the-project.md#add-a-release-gate)):

   ```json
   { "plugins": { "gates": { "options": { "gates": {
     "v1": { "title": "First release", "says": "what the first release waits on", "holdsOn": "code" }
   } } } } }
   ```

2. Put items on it:

   ```sh
   naima set second-bug gate=v1
   ```

3. Ask whether it holds:

   ```console
   $ naima gates
   v1 — First release: BLOCKED by 1
     ✗ bugs/second-bug  Second bug
   properties — Every property holds: HOLDS
   ```

`holdsOn` decides what blocks:

- `"code"` (the default): the gate waits for code. An item with no fix
  blocks; a fixed item that only owes its proof, and the proving gestures
  themselves, are listed as **owed** (`·`) but do not block.
- `"proof"`: every open item on the gate blocks.

`naima gates v1 --check` exits with 1 while the gate is blocked, so a release
script or CI can wait on it.

## The queue

The [queue](glossary.md#queue) is the open items on the gates, split by whose
hands their proof needs ([run by](glossary.md#run-by)):

```console
$ naima queue v1 --human
v1: 2 open — agent 0, human 2, build 0, unclassified 0
  with no code yet: 1; owing only proof: 1
  bugs/second-bug  Second bug  (human)
  tests/looks-right-phone  Looks right on a phone  (judgement)
```

`--human` lists what needs a person, each with why — the list to hand the
[owner](glossary.md#owner). "Unclassified" counts items whose `runBy` nobody
has set yet. Without a gate name, `naima queue` covers every gate.

## Other views

`naima view` lists the named views the loaded plugins offer, such as `next`
(open items, most urgent first); `naima view next --json` gives the data
behind it. Every command: [reference](../reference/reference.md).
