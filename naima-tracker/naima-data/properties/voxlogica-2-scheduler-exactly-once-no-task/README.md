# VoxLogicA 2 scheduler: exactly once — no task starts twice, the shared subterm included, and none is left unstarted

No task is started twice, including the subterm shared by three consumers,
and no run finishes with a task never started. Formula:
`develop/case-studies/voxlogica-2-scheduler/exactly-once.mcf`. The worker's duplicate guard — skip a popped task
that is completed or running — is what makes it hold: its negative
experiment, `develop/case-studies/voxlogica-2-scheduler/scheduler-no-guard.mcrl2` (the guard switched off, nothing
else), must be violated.

The model is the VoxLogicA 2 scheduler abstracted to its scheduling protocol, `develop/case-studies/voxlogica-2-scheduler/scheduler.mcrl2`; what each part of it stands for in the engine, and the results table, are in [the case study](../../../../develop/case-studies/voxlogica-2-scheduler/README.md). It holds when `naima verify` says so, with the mCRL2 toolset installed; none is installed on the machine where it was filed.
