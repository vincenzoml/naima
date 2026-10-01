# The coordination model

For people and agents who want to know why claims across branches can be
trusted, and for whoever runs the proof. The coordination plugin's claim
protocol is written as an mCRL2 specification, and its safety properties as
modal mu-calculus formulas that Naima's own verifier plugin checks, through
the `verifier-mcrl2` adapter
([properties proven by a tool](../naima/docs/guide/prove-and-close.md#properties-proven-by-a-tool)).

| File | What it holds |
|---|---|
| `develop/models/coordination/claims.mcrl2` | the protocol: branches, their claim files, commits, merges, retirement, and the read-time recombination |
| `develop/models/coordination/no-claim-lost.mcf` | once a branch claims an item, every read of its claims shows the item until it releases it |
| `develop/models/coordination/released-claim-never-reappears.mcf` | once a branch releases an item, no read of its claims shows it until it claims it again |

Each formula is a `properties` item naming the model, the formula and the
`mcrl2` verifier: `properties/no-claim-ever-lost-mcrl2-model-coordination` and
`properties/released-claim-never-reappears-mcrl2-model-coordination`.
`test/models/coordination-model.test.ts` checks, without the tool, that the
formulas use only actions and sorts the model declares, and that both rules
are on.

## What the model holds

- **Two branches and a trunk.** Each branch has its own worktree and owns one
  claim file; every tree (a branch's commit, the trunk) carries a copy of both
  files.
- **Actions.** A branch claims or releases an item on its working copy;
  commits its claim file; enters the trunk (`merge`); takes the trunk in
  (`sync`); and, once its claim is on the trunk, is retired — its worktree
  removed and the branch deleted, as `naima prune --branch` does.
- **The read.** `read(b, s)` is `naima claims` for branch `b`: from its
  worktree's disk while it has one — a record written or deleted and not yet
  committed is already the truth everywhere — and from the trunk's copy once
  the branch is gone. That is the rule `readAcrossBranches` implements.
- **The two rules, as switches.** `ff_only`: a branch enters the trunk only
  when its commit contains the trunk, so the merge is a fast-forward.
  `own_files_only`: a branch writes no file another branch owns. Both are
  `true` in the protocol.

Left out: session notes (one new file per note, never rewritten, so nothing to
lose), more than two branches and two items, a branch read from its ref
without a worktree, and git's own three-way merges. The model abstracts the
content of a claim file to the set of items it holds.

## Running it

The run needs the mCRL2 toolset (`mcrl22lps`, `lps2pbes`, `pbessolve`,
`lps2lts`) on `PATH`, or in `plugins.verifier-mcrl2.options.bin`; the plugin is
opted in in `naima-tracker/naima-data/naima.json`. The run:

```sh
deno task naima verify no-claim-ever-lost-mcrl2-model-coordination released-claim-never-reappears-mcrl2-model-coordination
```

Each run is attached to its item; a change to the model or a formula makes a
holding verdict stale, and `naima check` says so.

Measured on 2026-10-01 with mCRL2 202607.0: both properties hold; the two
runs take 135 s of wall-clock together.

## The negative experiment

Set `ff_only` or `own_files_only` to `false` in the model's equations and run
the same pipeline. Without `ff_only`, a branch that has not taken the trunk in
overwrites the trunk's copy of a retired branch's claim: both properties fail.
Without `own_files_only`, a branch empties another's claim file and merges it:
"no claim is ever lost" fails. `pbessolve`'s evidence is the counterexample. Measured on 2026-10-01 with mCRL2 202607.0: without `ff_only`, both
formulas are false; without `own_files_only`, "no claim is ever lost" is false
and "a released claim never reappears" still holds. The traces are attached to
the todo below.
This is tracked by `todos/mcrl2-model-coordination-protocol-complete-checked-negative`.
