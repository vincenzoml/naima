# Evidence digest covers one file; included-file changes and tool version go unnoticed

A model that includes another file stays 'current' when the included file changes; the tool version is not recorded.

Done: an adapter may declare a model's input closure and a tool version; the run record stores a digest over all inputs plus the version; `property-evidence` fails when either changes; a test shows an include change re-opening a property.
