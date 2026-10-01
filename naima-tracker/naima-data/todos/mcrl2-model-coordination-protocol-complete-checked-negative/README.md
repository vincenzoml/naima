# mCRL2 model of the coordination protocol complete and checked, with the negative experiment (drop the fast-forward rule or the no-shared-file rule, showing the counterexample)

The coordination plugin rests on a protocol: each session writes only its own
files (claims, session notes) on its own branch; collections are recombined at
read time from every branch worth reading; merges into the trunk are
fast-forward only. Its safety claims are stated in prose and tested by
example; this item proves them on a model, with Naima's own verifier plugin.

The model is `develop/models/coordination/claims.mcrl2`, described in
[the coordination model](../../../../develop/coordination-model.md). Its two
rules are switches (`ff_only`, `own_files_only`), true in the protocol.

Candidate properties beyond the two filed:

- no two sessions ever write the same path;
- a record committed on an unmerged branch is visible from every checkout;
- a fast-forward merge never discards a record;
- releasing the last claim leaves no claim behind on that branch.

- [x] write the model
- [x] file "no claim is ever lost" and "a released claim never reappears" as
  properties items pointing at it (`properties/no-claim-ever-lost-mcrl2-model-coordination`,
  `properties/released-claim-never-reappears-mcrl2-model-coordination`)
- [x] verify both with the mCRL2 adapter: `naima verify` on each — both hold
  (mCRL2 202607.0, 2026-10-01; run records attached to each property)
- [x] negative experiment: set `ff_only` (or `own_files_only`) to `false`, run
  the same pipeline, and attach the counterexample `pbessolve` gives — both
  switches run, counterexamples attached (`negative-experiment-mcrl2-202607.0.txt`)

## Notes

### 2026-10-01 — triage agent, on claude/effort-triage

Read naima-paper/sections/protocol.tex in full (the existing TLA+ sketch and its own todo): completing the spec, a bounded multi-session model, two tool runs (mCRL2/Apalache per the paper, or mCRL2 per project convention), and a negative-experiment counterexample is a substantial modeling task.

### 2026-10-01 — Vincenzo Ciancia, on claude/big-mcrl2-model

Model and properties written; running them needs mCRL2 installed - owner action: installing the toolset is a download the owner approves, so the run is the owner's gesture (runBy human, humanBecause decision).

### 2026-10-01 — Vincenzo Ciancia, on claude/mcrl2-coordination-check

mCRL2 202607.0 (official arm64 release) installed and run. Positive: through the launcher, naima verify gives holds on both properties (135 s wall-clock for the two). Negative, same pipeline on the model with one switch set to false: ff_only=false makes both formulas false (no-claim-lost: 6-step trace ending in a retired branch read empty after another branch's non-fast-forward merge; released-claim-never-reappears: 10-step trace where a stale commit brings a released claim back); own_files_only=false makes no-claim-lost false (8-step trace through write_other) while released-claim-never-reappears still holds, as the coordination-model page predicted. Traces in the attachment.
