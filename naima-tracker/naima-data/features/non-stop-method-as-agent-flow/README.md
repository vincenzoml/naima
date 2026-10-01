# Non-stop method as an agent flow

Today the coordinator flow only says 'set a timer'. The owner wants agents that keep working while he is away and hand him one ordered list when he returns, not a company that stops the moment nobody is watching.

Done:
- a flow page ('Running the company') states the loop: write the work list before starting; a default wake-up timer of 3 minutes, configurable.
- the flow REQUIRES an explicit target, chosen before starting: a work-list item, an epic, or a gate.
- the stop condition derives from the target: a work list is done when every line is done or each remaining line carries a written deferral; an epic is done when every item is closed or needs only the owner; a gate holds only the owner's work, computed by `naima queue`.
- on each tick the agent asks 'am I done, or did I stop?', merges finished unowned branches, removes merged worktrees, and spawns workers on what needs no locked resource; a deferral is written, never skipped.
- the deliverable is the owner's ordered action list, each line saying why it is his.
- `naima queue` (or a `--stop` mode) prints whether the stop condition holds, with a test; the agent index table lists the flow.

Depends on epics existing as a target kind (see the epics/milestones item).
