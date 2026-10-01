# Cross-branch reads start O(refs x files) git subprocesses on every call

Consolidated review 2026-09-30, id `R-15` (see the linked review item for
the full review). Severity as scored by the review: **medium**,
status **CONFIRMED**.

## Where

`src/core/git.ts:84-119; src/plugins/coordination/index.ts:74-98,253-279`

## What is wrong (the failure)

With 30 branches, `naima summary` starts 195 git processes and takes 2.3 seconds, because each file of each ref is fetched with its own subprocess and nothing is memoized.

## The fix

Use one `git ls-tree -r` and one `git cat-file --batch` per ref, memoize the result per Context, and compute the ref list once per run.

## Evidence

Measured: reproduced with the script below; its output is attached.

Repro: `perf.txt` (the measured subprocess counts and timings), attached in
`attachments/`. The 300- and 3,000-branch fixture repositories themselves
(`cleancode/perf300`, `cleancode/perf3000` in the review scratchpad) are git
repositories in their own right and were not copied in as attachments, to
avoid nesting a git repository inside this one; `perf.txt` carries their
measured results.

## Done

performance test: `naima summary` on a 30-branch fixture starts a bounded, small number of git subprocesses and completes well under 2.3s, evidence in `perf.txt`
