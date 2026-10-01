# No claim is ever lost, in the mCRL2 model of the coordination protocol

Once a branch claims an item, every read of that branch's claims — recombined
across branches as `naima claims` does — shows the item until the branch
releases it: through commits, fast-forward merges into the trunk, syncs from
the trunk, and the branch's retirement, after which its claims are read from
the trunk's copy. A claim lost this way is work two sessions take up at once.

The model is `develop/models/coordination/claims.mcrl2`, the formula
`develop/models/coordination/no-claim-lost.mcf`; what the model covers and
leaves out: [the coordination model](../../../../develop/coordination-model.md).
`naima verify no-claim-ever-lost-mcrl2-model-coordination` decides it.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/big-mcrl2-model

Needs mCRL2 installed - owner action. The mCRL2 toolset is not on this machine and installing it is a download the owner approves; once it is on PATH (or in plugins.verifier-mcrl2.options.bin), naima verify runs the property. Until then it stays open, never run.
