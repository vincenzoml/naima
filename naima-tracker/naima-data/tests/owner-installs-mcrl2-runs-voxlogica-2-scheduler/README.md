# The owner installs mCRL2, runs the VoxLogicA 2 scheduler case study, and chooses which of its results the paper reports

Needs the owner for two reasons: installing a toolset on the machine is the
owner's (agents may not download), and which results the paper reports is
the owner's judgement.

1. Install the mCRL2 toolset (https://www.mcrl2.org) so that `mcrl22lps`,
   `lps2pbes`, `pbessolve` and `lps2lts` are on PATH, or set
   `plugins.verifier-mcrl2.options.bin` in `naima-tracker/naima-data/naima.json`.
2. Run `deno test -A test/case-studies/`: the live test checks that the four
   properties hold on the model and that each negative variant is violated.
   If mCRL2 rejects the model, the error names the line: the model was
   written where mCRL2 is not installed and has never been parsed.
3. Run `naima verify` on the four VoxLogicA 2 scheduler property items (each
   title begins "VoxLogicA 2 scheduler:"); each run is attached.
4. Fill the results table of the case study
   (develop/case-studies/voxlogica-2-scheduler/README.md) from those runs and
   `lps2lts --verbose` state counts, then choose the rows the paper's
   case-study section and the abstract's one sentence report.

Passed when all four hold, both negatives are violated, and the paper's
rows are chosen.
