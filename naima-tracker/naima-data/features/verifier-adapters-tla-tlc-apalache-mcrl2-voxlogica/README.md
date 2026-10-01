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
