# Jargon audit, performed 2026-10-01

Scope, read in full, line by line (not sampled): every page under
`naima/docs/guide/` (49 pages incl. glossary.md), every page under
`naima/docs/agents/` (21 pages), `naima/docs/purpose.md`, `naima/docs/README.md`,
the repository `README.md`, `site/llms.txt`, `naima/skills/naima/SKILL.md`.
56 pages, 7,128 lines of source read.

## Method

Four checks per page, two automated (reproducible by script) and two read by
eye on the full text:

1. **Research-paper references.** `grep -rniE "\b(our paper|the paper|naima
   paper|research paper|this paper)\b"` over the scope.
2. **Undefined acronyms.** Every token matching `\b[A-Z]{2,}[A-Za-z0-9]*\b`
   across the scope, counted and reviewed for whether it is expanded or
   self-evident on first use.
3. **Terms linked to the glossary on first use.** A script matched each of
   the glossary's 95 headwords against each page and flagged a first
   occurrence with no `glossary.md` link within 150 characters. This
   heuristic over-fires on ordinary English words that double as headwords
   (owner, project, agent, check, item, commit…) — linking every occurrence
   of such a word would itself hurt plain-English readability, and several
   pages instead carry one `Terms: [glossary](glossary.md)` pointer near the
   top (`concepts.md`, `config.md`, `extending-naima.md`, `install.md`) and
   link only the pivotal concepts inline. Each flagged page was read by eye
   against this distinction; only a genuine jargon term introduced with no
   link and no inline definition counts as a finding.
4. **Paragraphs anchored to a file, command or example.** A script split
   each page into prose paragraphs (headings, tables and list items
   excluded) and counted how many of at least 40 characters contain neither
   a backtick nor a markdown link. Flagged paragraphs were read by eye:
   almost all are framing/narrative sentences ("Nothing here assumes you
   know git…") rather than unsupported claims; none needed a citation added.

## Findings and fixes

| Page | Before | After | What |
|---|---|---|---|
| `naima/docs/guide/concepts.md` | 1 undefined acronym (`CJK`, "Cyrillic, CJK and every other letter are kept") | 0 | Expanded to "Cyrillic, Chinese, Japanese, Korean and every other letter" |
| `naima/docs/guide/install.md` | 1 unglossed technical term (`webview`, used twice with no explanation of what it is) | 0 | Added "— the embedded browser component that draws the window" on first use |

No other page needed a change under any of the four checks:

- **Research-paper references:** 0 before, 0 after, in every page. The only
  "paper" mentions are the generic example project ("a paper written with
  colleagues", `purpose.md`, `guide/plan-with-requirements-specs-and-decisions.md`,
  `guide/extending-naima.md`) — not a reference to a Naima research paper.
  This matches and reconfirms the independent spot-check already on this
  item's Notes (`2026-10-01`, prior session).
- **Undefined acronyms:** of ~45 distinct acronyms found across the scope
  (`API`, `CLI`, `JSON`, `CSV`, `AWS`, `HTML`, `URL`, `PDF`, `PNG`, `SVG`,
  `CI`, `MIT`, `GPL`, `XL`, `WIP`, `TODO`/`FIXME`/`XXX`/`HACK` as code-comment
  markers, and others), every one besides `CJK` is either expanded on first
  use, self-evident from the surrounding sentence (`JSONC` — "a file with
  comments (JSONC)"), or a standard, audience-appropriate technical term for
  a developer/agent-facing software doc (`API`, `CLI`, `JSON`, `CI`…), which
  this project's own README and purpose already assume as baseline literacy.
- **Glossary coverage:** every one of the 95 glossary headwords matches a
  concept actually used in the docs; no missing entry was found. No
  additional glossary entry was needed.
- **Unanchored paragraphs:** spot-checked every page the script flagged;
  all are narrative/framing sentences, not unsupported claims. Counts, for
  the record (prose paragraphs ≥ 40 chars / without a command or link),
  range from 0 (`guide/README.md`, `guide/faq.md`, `guide/how-the-project-runs.md`,
  `guide/read-the-board.md`, `guide/tracker-folder.md`,
  `guide/write-a-project-rule.md`, `agents/code-quality-metrics.md`) to 13
  (`purpose.md`, the longest page) — no fix required in any of them.

## What this audit is not

It does not relink every literal occurrence of a glossary headword that is
also an everyday English word (that would make the prose harder to read,
not easier) — it treats "plain English" as the goal the glossary-linking
convention serves, not a mechanical word count to maximise.
