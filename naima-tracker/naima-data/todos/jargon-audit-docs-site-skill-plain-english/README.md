# Jargon audit of docs, site and skill: plain English, one glossary, no paper references

Owner's observation: the documentation is probably full of jargon and deep-dives into the void.

Done: every doc page, the site and the skill are read for jargon; every term is defined once in a glossary and every paragraph anchors to a file, command or example; no reference to the research paper remains anywhere in vision or docs; links-resolve and docs-pages checks still pass.

## Notes

### 2026-10-01 — Claude, on claude/evidence-close-3

Evidence mismatch: attached verify.log/node-test.log only show deno task verify and node --test passing — they prove nothing about jargon, glossary completeness or paper references, which is what this item claims. Spot-checked independently: naima/docs/guide/glossary.md exists (582 lines); no reference to 'the Naima paper' / 'our paper' found in docs (only generic 'a paper' used as an example project, which is not in scope). The audit itself (read-through for jargon, one-definition-per-term check) was not performed or evidenced. Reopening: clear fixedOn, set status back to open pending real audit evidence.
