# VoxLogicA 2 scheduler case study: description, model, its properties checked, results table

The product-level case study of the Naima paper: the parallel scheduler of
VoxLogicA 2 described, modelled in mCRL2, its four properties filed as
property items and checked with `naima verify`, and the results table the
abstract's sentence cites.

- [x] The description, in [the case study](../../../../develop/case-studies/voxlogica-2-scheduler/README.md): what of the engine
  the model keeps, where each part lives in VoxLogicA 2's code, what is left
  out.
- [x] The model, `develop/case-studies/voxlogica-2-scheduler/scheduler.mcrl2`, and two negative variants, each with
  one safeguard switched off; `test/case-studies/voxlogica-2-scheduler.test.ts`
  holds the variants to that and, where mCRL2 is on PATH, checks every verdict.
- [x] The four properties filed, each with `verifier`, `model` and
  `property` set, and each verifying this item.
- [ ] The four properties hold under `naima verify`, and both negatives are
  violated, on a machine with the mCRL2 toolset.
- [ ] The results table in the case study filled from those runs; which rows
  go in the paper is the owner's choice.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/big-voxlogica-case

Built on branch claude/big-voxlogica-case. The model, formulas, negative variants and description are in develop/case-studies/voxlogica-2-scheduler/; the four property items are filed and wired to verifier-mcrl2, which is now switched on in naima.json.

Measured here: naima verify ran on all four and recorded error, "tool missing: mcrl22lps" — the mCRL2 toolset is not installed on this machine, and installing it was out of scope. The VoxLogicA verifier (VoxLogicA 1.3.3, installed) does not apply: it checks properties of images, not of a process.

Not the mCRL2 run, and not evidence for the property items: a hand transcription of the model's process into Python (attached, scheduler-explore.py, with its output) explored every state and gave the verdicts the model is meant to give — all four hold on the model; exactly once fails without the duplicate guard; deadlock freedom fails without the progress floor. It shows the abstraction says what it should; it says nothing about whether scheduler.mcrl2 parses, which nothing here could check.
