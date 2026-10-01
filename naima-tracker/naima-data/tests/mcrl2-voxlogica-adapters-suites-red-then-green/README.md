# mCRL2 and VoxLogicA adapters: suites red then green, VoxLogicA live

Proves the verifier adapters for mCRL2 and VoxLogicA by gesture.

## Gesture

```sh
deno test -A test/plugins/verifier-mcrl2 test/plugins/verifier-voxlogica   # then node --test and bun test on the whole suite
```

`test/plugins/verifier-mcrl2/mcrl2.test.ts` pins, on replayed tool output: the pipeline and its arguments (mcrl22lps, lps2pbes --counter-example with the formula as a file, pbessolve with an evidence file); true holds; false is violated with the lps2lts-printed evidence as counterexample; a missing tool is an error beginning "tool missing:" and `version` rejects; a failing tool is an error with its output and nothing runs after it; a time limit hit and any answer but true/false are unknown; an .mcf property is read from the project root and declared as an input; `bin` and `runs`; through `naima verify`, the tool version recorded, and a missing tool recorded as an error run; the plugins are opt-in (not loaded, not granted by the launcher, unless naima.json names them); switched on, both are documented. A live test runs the real tools where mcrl22lps is on PATH.

`test/plugins/verifier-voxlogica/voxlogica.test.ts` pins, on VoxLogicA 1.3.3's own recorded `--json` output: a printed bool true holds, false is violated with every printed value; an unprinted name, or a number, is an error; a rejected session is an error with the tool's message; non-JSON output is an error; a missing tool; a time limit; inputs (session, loaded images, imported sessions, the tool's library left out, comments ignored); version from the option, from VoxLogicA.deps.json, or "unknown"; through `naima verify`, the image an input of the run. A live test runs the real VoxLogicA where it is found.

Must appear: red before the adapters exist; green on Deno, Node and Bun; the VoxLogicA live test passing, not skipped, on a machine that has it.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u16-adapters

Ran this session: red, both new suites failed to load (TS2307, adapter modules absent). Green: deno task verify 310 passed 0 failed 1 skipped (the mCRL2 live test); node --test 310 pass 0 fail 1 skipped; bun test 310 pass 0 fail 1 skip. VoxLogicA 1.3.3 ran for real from ~/bin/VoxLogicA (live test passed). Not verified: mCRL2 is not installed here, so its live test was skipped and its fixtures are transcribed from the toolset's documented output, not recorded; neither tool was run under the launcher's narrowed permissions.
