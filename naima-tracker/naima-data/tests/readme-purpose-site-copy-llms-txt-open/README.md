# README, purpose, site copy and llms.txt open with the framing sentence and the vibe-coding problem; open-source limitation removed from role pages

README, purpose, site copy and llms.txt open with the framing sentence and the vibe-coding problem; open-source limitation removed from role pages

Open README.md, naima/docs/purpose.md, site/index.html (both the agent block and the "about" paragraph) and site/llms.txt. Each must open with the silent-software-house/vibe-coding-into-science framing sentence and name the vibe-coding problem it solves: unverified, unrecorded, unrepeatable, uncoordinated, roleless. grep -ri "calibrated for open source" across naima/docs/agents/*.md must return nothing. test/site.test.ts, docs-pages and links-resolve (part of `deno task verify`) must still pass.

## Notes

### 2026-10-01 — evidence owner, on claude/evidence-close-6

Evidence review: the attached _verify-tail.txt is misattached — it shows an unrelated formatting error from another worktree (f-u2-age, test/plugins/triage/triage.test.ts), not this change. The substantive claim is independently verified here: node --test test/site.test.ts test/docs-pages.test.ts, 11/11 pass (site-docs-check-2026-10-01.log), and the framing sentence is confirmed present in README.md, purpose.md, site/index.html and llms.txt per the existing run2.txt grep. Closing on this corrected basis.
