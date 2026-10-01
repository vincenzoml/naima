# Coordination-protocol properties filed as property items in Naima and verified by the mCRL2 verifier plugin

Done when each coordination-protocol property is a `properties` item naming
the `mcrl2` verifier, the model `develop/models/coordination/claims.mcrl2` and
its formula, and `naima verify` has run it and it holds.

- [x] "no claim is ever lost": `properties/no-claim-ever-lost-mcrl2-model-coordination`
- [x] "a released claim never reappears": `properties/released-claim-never-reappears-mcrl2-model-coordination`
- [x] the `verifier-mcrl2` plugin opted in, in `naima-tracker/naima-data/naima.json`
- [x] both verified, and holding: `naima verify no-claim-ever-lost-mcrl2-model-coordination released-claim-never-reappears-mcrl2-model-coordination`
  with mCRL2 202607.0, 2026-10-01

## Notes

### 2026-10-01 — triage agent, on claude/effort-triage

Read naima-paper/sections/protocol.tex and naima/src/plugins/verifier-mcrl2/index.ts (184 lines, adapter exists): filing the four protocol properties and getting naima verify green depends on the mCRL2 model from todos/mcrl2-model-coordination-protocol-complete-checked-negative existing; wiring items to an existing adapter once the model is there is still multi-item setup work.

### 2026-10-01 — Vincenzo Ciancia, on claude/big-mcrl2-model

Model and properties written; running them needs mCRL2 installed - owner action: installing the toolset is a download the owner approves, so the run is the owner's gesture (runBy human, humanBecause decision).

### 2026-10-01 — Vincenzo Ciancia, on claude/mcrl2-coordination-check

Both properties verified with mCRL2 202607.0 through naima verify: holds and holds; run records attached to each property.
