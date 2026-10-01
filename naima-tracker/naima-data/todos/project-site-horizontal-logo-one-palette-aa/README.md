# Project site: a horizontal logo, one palette with AA contrast, and an agent prompt that adds Naima to the host's agent file

The owner's feedback on the site with the vertical logo (git tag `site/vertical-logo`):
the logo is too big. And three additions from the owner, through the coordinator:
a Documentation button, a sentence saying what Naima is, a GitHub link with a star call to action.

- [x] The logo settles into one line, NAIMA, with AI accented; the intro keeps main → maain → logo by FLIP,
      letters moving left arc over, letters moving right dip under. The mark is 44–68 px; the tagline is the message.
- [x] The vertical variant is named, with its tag and why it was replaced, in one comment above the logo markup.
- [x] One palette in `site/index.html` (`/* palette */`), each token once through `light-dark()`; every text pair
      AA (minimum 4.98:1, the light accent on the surface); the same accent for AI, the branch chips, links and focus.
- [x] The agent prompt, 5 lines, opens with what Naima is and ends with the line to paste verbatim into the host's
      AGENTS.md / CLAUDE.md; llms.txt gives the same line as step 5.
- [x] Documentation: `scripts/site.ts` renders the docs (root found by its `README.md` map, at `naima/docs/` or
      `docs/`) into site-styled pages under `docs/`, nav from the map, links relative inside the docs and to GitHub
      outside them; Pages builds it (`.github/workflows/pages.yml`), triggered by docs changes too.
- [x] "Star on GitHub" links the repository; the count is written at build time from the GitHub API, none without it.
- [ ] How it looks: the owner's call (the linked test item).

Proven by `src/site.test.ts` on Deno, Node and Bun: the logo reads NAIMA, the palette is the only source of colour,
the prompt's five lines, the renderer, link rewriting, and every link of the built docs landing on a page and anchor.
