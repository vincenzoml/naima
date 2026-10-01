# VoxLogicA 2 scheduler: dependency order — no task starts before every task it depends on is done

No task starts before every task it depends on is done. Formula:
`develop/case-studies/voxlogica-2-scheduler/dependency-order.mcf`.

The model is the VoxLogicA 2 scheduler abstracted to its scheduling protocol, `develop/case-studies/voxlogica-2-scheduler/scheduler.mcrl2`; what each part of it stands for in the engine, and the results table, are in [the case study](../../../../develop/case-studies/voxlogica-2-scheduler/README.md). It holds when `naima verify` says so, with the mCRL2 toolset installed; none is installed on the machine where it was filed.
