# Coordination-protocol properties filed as property items in Naima and verified by the mCRL2 verifier plugin

Done when each coordination-protocol property is a `properties` item naming
the `mcrl2` verifier, the model `develop/models/coordination/claims.mcrl2` and
its formula, and `naima verify` has run it and it holds.

- [x] "no claim is ever lost": `properties/no-claim-ever-lost-mcrl2-model-coordination`
- [x] "a released claim never reappears": `properties/released-claim-never-reappears-mcrl2-model-coordination`
- [x] the `verifier-mcrl2` plugin opted in, in `naima-tracker/naima-data/naima.json`
- [ ] both verified, and holding — needs mCRL2 installed, owner action: the
  toolset is a download the owner approves; with it on PATH, run
  `naima verify no-claim-ever-lost-mcrl2-model-coordination released-claim-never-reappears-mcrl2-model-coordination`

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/big-mcrl2-model

Model and properties written; running them needs mCRL2 installed - owner action: installing the toolset is a download the owner approves, so the run is the owner's gesture (runBy human, humanBecause decision).
