# VoxLogicA 2 scheduler: determinism of results — every task's value equals its sequential evaluation, whatever the interleaving

Whatever the interleaving the scheduler chooses, the value recorded for every
task equals its sequential evaluation (`ref` in the model): each kernel
reads its inputs from the value table when it starts. Formula:
`develop/case-studies/voxlogica-2-scheduler/determinism.mcf`.

The model is the VoxLogicA 2 scheduler abstracted to its scheduling protocol, `develop/case-studies/voxlogica-2-scheduler/scheduler.mcrl2`; what each part of it stands for in the engine, and the results table, are in [the case study](../../../../develop/case-studies/voxlogica-2-scheduler/README.md). It holds when `naima verify` says so, with the mCRL2 toolset installed; none is installed on the machine where it was filed.
