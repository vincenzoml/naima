# Write-time hooks: `beforeWrite` (can veto) and `afterWrite`, in load order

## Behaviour

Every core write path (create, set, link, move, close) routes through
ordered `beforeWrite` (which can veto with a refusal message) and
`afterWrite` plugin hooks, run in plugin load order. This enables, without
further core changes:

- auto-stamping `triagedOn` on any `set` of a triage field;
- resetting a property's status to `open` when its `property`, `model` or
  `verifier` field changes (closing part of D-06's underlying problem at the
  write site rather than only at read time);
- refusing a manual `set status=holds` that bypasses the verifier;
- enforcing AGENTS.md's rule "a branch does not close its own items on the
  strength of its own tests" — confirmed unenforced today at
  `src/plugins/trackers/index.ts:98-118` — with an explicit `--force` reserved
  for the evidence owner.

## Boundaries

- Every public write helper is routed through the hook chain; there is no
  write path left that bypasses it.
- A `beforeWrite` veto must give a message a human or agent can act on
  (matching the "asking the human" standard elsewhere in the project) — a
  hook that vetoes silently is a defect, not a feature.
- This does not itself implement the own-branch close rule's full logic;
  it provides the mechanism the close command's veto hook uses.

## Documentation

`docs/plugin-contract.md` documents the hook signatures, ordering guarantee,
and how a veto is reported to the caller.

Source: REVIEW.md section 2, decision D-07 (recommendation b); DECISIONS.md
line 8.
