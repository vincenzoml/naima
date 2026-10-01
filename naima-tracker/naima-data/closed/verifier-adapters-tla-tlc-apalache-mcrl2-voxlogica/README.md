# Verifier adapters for mCRL2 and VoxLogicA

The verifier plugin ships the contract and one trivial adapter
(`example-regex`). Real adapters make a property item a proof of a real
property.

Each adapter maps one tool's invocation, exit status and output to a verdict
(`holds`, `violated`, `error`, `unknown`) and returns the trace the tool
printed as the counterexample. Each ships as its own plugin that contributes
`verifiers`, with its own tests, and needs the tool on the machine.

- [ ] mCRL2: `mcrl22lps` → `lps2pbes` → `pbes2bool`, with a counterexample
      from `pbessolve` evidence
- [ ] VoxLogicA: spatial model checking over images; verdict per query
- [ ] a fixture per adapter that runs in CI when the tool is present and is
      skipped, visibly, when it is not

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u16-adapters

Built on claude/u16-adapters, commit 1605dc7: two opt-in plugins, verifier-mcrl2 and verifier-voxlogica, each off until naima.json names it. Counterexample for mCRL2 is the pbessolve evidence printed by lps2lts. The commits field is not in the locked tracker yet, so the commit is named here. Proof: tests/mcrl2-voxlogica-adapters-suites-red-then-green.
