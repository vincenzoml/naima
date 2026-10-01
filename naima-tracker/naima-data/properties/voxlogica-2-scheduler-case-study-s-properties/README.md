# VoxLogicA 2 scheduler: deadlock freedom — until the run finishes, the scheduler can always take a step

Until a run has finished, the scheduler can always take a step of its own:
memory pressure and duplicate offers, which come from outside the
scheduler, do not count as progress. Formula:
`develop/case-studies/voxlogica-2-scheduler/deadlock-freedom.mcf`. The progress floor of memory parking is what
makes it hold: its negative experiment, `develop/case-studies/voxlogica-2-scheduler/scheduler-no-floor.mcrl2`
(the floor switched off, nothing else), must be violated.

The model is the VoxLogicA 2 scheduler abstracted to its scheduling protocol, `develop/case-studies/voxlogica-2-scheduler/scheduler.mcrl2`; what each part of it stands for in the engine, and the results table, are in [the case study](../../../../develop/case-studies/voxlogica-2-scheduler/README.md). It holds when `naima verify` says so, with the mCRL2 toolset installed; none is installed on the machine where it was filed.

## Notes

### 2026-10-01 — triage agent, on claude/effort-triage

Read the item: an explicit placeholder that is split into the real property items once todos/voxlogica-2-scheduler-case-study-description-model is built; this item's own remaining work is the split, not the modeling.
