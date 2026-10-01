# Coverage of a normative list (NO TEST check)

A hand-kept copy of a declared list (paid features, limits, API endpoints) goes stale; one entry with no proving test is a promise nobody holds.

Done: config names a source (a JSON path or a regex over files) yielding entry ids; a field or tag on test items names the entry each proves; `naima coverage` prints every entry with its test or NO TEST; `--check` exits 1 on NO TEST; a gate can require it; the list is read from its source on every run, never copied.
