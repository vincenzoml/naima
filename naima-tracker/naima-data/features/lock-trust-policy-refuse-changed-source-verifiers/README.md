# Lock trust policy: refuse a changed source; verifiers declare `runs`

## Behaviour

- Today, any ordinary command silently follows a pulled change of
  `source`/`commit` (`src/core/program.ts:113` rewrites `origin` without
  asking). Going forward, a command refuses to proceed when the lock's
  `source` has changed since the program directory was last aligned, printing
  "locked commit moved a -> b", until `naima update --accept-source` is run
  explicitly. An opt-in `verify: "signed"` lock option is available for
  projects that want signed-commit verification.
- Verifier adapters declare `runs: string[]`, the external tools they invoke
  (for example `mcrl22lps`, `lps2pbes` and `pbes2bool`, the mCRL2 toolset's
  pipeline for model checking concurrent systems); these are collected at
  program alignment time into the launcher's `--allow-run` list. This closes
  the gap
  where the launcher grants only `--allow-run=git`
  (`src/launcher.ts:49`, verified), making every real external-tool verifier
  adapter impossible to run today.

## Boundaries

- `naima update --check` (read-only) is unaffected: the refusal applies to
  commands that would otherwise silently realign the program.
- Declared `runs` values are collected only from verifier adapters actually
  configured for the project, not granted globally.

## Documentation

`docs/install.md#every-run-aligns-the-program` documents the refusal and
`--accept-source`; `docs/plugin-contract.md` documents the verifier
`runs` declaration and how it reaches the launcher's permissions.

Source: REVIEW.md section 2, decision D-12 (recommendation b and c);
DECISIONS.md line 13.
