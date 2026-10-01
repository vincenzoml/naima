# Epics, milestones and gates the owner can create by command

Restores what the owner had and lost: planning above single items.

- **Epics.** An `epics` item type groups items (`part-of` from an item to its
  epic; `has-part` derived). Its status is derived from its items: open while
  any is open, done when all are closed. `naima epic` shows each epic with
  its progress (n of m closed), what blocks it, and whose hands it waits on.
  An epic can carry a gate: the gate then stands for the epic's items.
- **Milestones.** A gate may carry a `due` date and a `version`; `naima gates`
  and `naima queue` show the days left or overdue, and a check warns when a
  milestone that does not hold is past its date.
- **Gates by command.** Today a gate exists only if someone edits
  `naima.json` by hand, so the owner cannot even say "that is a gate".
  `naima gate new|add|remove|show` declare a gate and put items on it,
  validated, through the CLI and its write hooks: an agent can run them from
  a sentence like "that's a gate for the beta".
