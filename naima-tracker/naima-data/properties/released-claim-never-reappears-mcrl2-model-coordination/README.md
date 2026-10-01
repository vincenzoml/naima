# A released claim never reappears, in the mCRL2 model of the coordination protocol

Once a branch releases an item, no read of that branch's claims — recombined
across branches as `naima claims` does — shows the item again until the branch
claims it anew, whatever other branches merge or sync meanwhile. A released
claim that comes back holds an item nobody is working on.

The model is `develop/models/coordination/claims.mcrl2`, the formula
`develop/models/coordination/released-claim-never-reappears.mcf`; what the
model covers and leaves out:
[the coordination model](../../../../develop/coordination-model.md).
`naima verify released-claim-never-reappears-mcrl2-model-coordination` decides it.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/big-mcrl2-model

Needs mCRL2 installed - owner action. The mCRL2 toolset is not on this machine and installing it is a download the owner approves; once it is on PATH (or in plugins.verifier-mcrl2.options.bin), naima verify runs the property. Until then it stays open, never run.
