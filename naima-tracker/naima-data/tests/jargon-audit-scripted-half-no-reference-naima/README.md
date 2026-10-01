# Jargon audit, scripted half: no reference to Naima's paper in docs, site or skill; the glossary exists; docs links resolve

## Gesture

The scripted half of the jargon audit (the reading half is the owner's: tests/owner-reads-tutorial-guide-finds-them-clear).

1. `grep -rniE "naima paper|research paper|our paper|the paper\b|FormaliSE|EasyChair|LNCS" naima/docs naima/skills README.md site/llms.txt site/index.html`, excluding the generated reference.
2. `naima/docs/guide/glossary.md` exists and the docs-pages and links-resolve tests pass (`test/docs-pages.test.ts`).

Pass: step 1 finds only the generic example of a paper as a project someone tracks, never a reference to Naima's research paper; step 2 holds.

## Result

2026-10-01, final sweep (claude/final-sweep): step 1 finds five lines, all the example project ("the paper targets the journal, not the conference", "the paper's claim" in extending-naima.md, the checklist in planned.md), none naming Naima's paper. The glossary exists (104 entries and headings); the docs tests pass in the sweep's gates.
