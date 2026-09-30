# Project site on GitHub Pages: the animated Naima logo, a one-line install per platform, and a prompt for agents

## Owner's words (paraphrased from the Italian, via the coordinator)

Create the GitHub Pages site. Spectacular and at the same time minimalist.
Title "Naima". Tagline: "We put the AI in your main." — "main" has a
different affordance: it is the git branch. Naima is a logo, stacked on three
lines, `N` / `AI` / `MA`, animated: "main" → "maain" → logo. Then a one-line
install per platform (macOS, Linux, Windows). And a 5-line prompt for an AI
agent that points it at the page and makes it install Naima in a repository.
Full stop — nothing else on the page. "E lo testiamo" (and we test it).

## Definition of done

- **The page**, `site/index.html`: one static file, no framework, no build
  step, no external request (system fonts). Title "Naima"; the tagline with
  `main` rendered as a branch chip (monospace); the stacked logo `N` / `AI` /
  `MA`, animated in about 2–3 s with the Web Animations API and FLIP — `main`,
  a second `a` inserted (`maain`), then the five letters travel into the
  stack — and then still. Dark and light follow the system;
  `prefers-reduced-motion` shows the final logo at once; phone width with no
  horizontal scroll; copy buttons on each one-liner and on the prompt; the
  logo's accessible name is "Naima", the animation is `aria-hidden`.
- **The one-liners**: `curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh`
  (macOS, Linux) and `irm https://vincenzoml.github.io/naima/install.ps1 | iex`
  (Windows PowerShell).
- **The installers**, `site/install.sh` (POSIX sh, `set -eu`, no bashisms) and
  `site/install.ps1`: run in the root of a git repository; refuse politely
  outside one; require git; install Deno with its official installer when
  missing, saying so (with `NAIMA_NO_DENO_INSTALL` set they print how
  instead and stop); clone the `dist` branch (full, as `docs/install.md`
  documents: the lock and update logic is not tested on a shallow clone)
  into `naima-tracker/naima`; run `init`; print next steps. Idempotent: a
  rerun in an installed repository says so and runs `naima check`, never
  re-inits. `NAIMA_SOURCE` and `NAIMA_REF` override the source and branch.
- **The agent prompt**, 5 lines on the page, copyable: read
  `https://vincenzoml.github.io/naima/llms.txt`, install with the one-liner
  for your OS, run `naima check`, read the Naima skill.
- **`site/llms.txt`** says the install for agents; `site/favicon.svg` is the
  stacked logo.
- **Deploy**: `.github/workflows/pages.yml`, the official Pages actions,
  least-privilege, on push to `main` touching `site/**` and on
  `workflow_dispatch`. Enabling Pages in the repository settings is the
  owner's (not this change).
- **Tests**: the installers run on macOS for real against a locally built
  dist (fresh, rerun, not-a-repository); a CI job runs them on Ubuntu, macOS
  and Windows; a Deno test holds the page's URLs to the files.

## Boundaries

- `site/` is not in the dist allowlist (`dist.json`): no project receives it.
- Nothing else on the page: no feature list, no docs, no navigation.
- How it looks is the owner's judgement.

## Documentation

`docs/install.md` gives the one-liners; `README.md` links the site.
