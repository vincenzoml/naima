# Evidence digest covers one file; included-file changes and tool version go unnoticed

A model that includes another file stays 'current' when the included file changes; the tool version is not recorded.

Done: an adapter may declare a model's input closure and a tool version; the run record stores a digest over all inputs plus the version; `property-evidence` fails when either changes; a test shows an include change re-opening a property.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Fixed on claude/u10-proof-integrity. Verifier adapters may declare inputs(request, ctx) and version(ctx). The run record stores each input with its sha256, the tool version and one digest over them (inputsSha256). property-evidence reports a property stale when an input changes, when the model reads a different set of files, or when the version moves. The example-regex adapter now reads #include lines and declares them as inputs.
