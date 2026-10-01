# Defined-value lists for classifiers (area, kind, gate, epic)

A value with no definition is a guess that sorts and filters as if it were a fact; `area` drifted from 10 defined values to 32 used ones in a comparable method.

Done: a field may declare an open list of values, each with a title and description, kept in project config; a plugin can extend it; `naima check` reports a value not on the list (a problem for gate/epic, a note for area/kind); `naima types` prints values with their counts; adding a value means writing its definition in the same commit; `kind` can name a role.
