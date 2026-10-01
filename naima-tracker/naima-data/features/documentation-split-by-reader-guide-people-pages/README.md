# Documentation split by reader: a guide for people, pages for agents, one rules page

The owner's brief, verbatim in substance: separate the agent docs from the
human docs; add a tutorial and an everyday guide by task; assume by default
that the reader never touches the code; make the documentation organic,
clear and full-coverage; clarify that the rule "features must be documented"
means documented both for agents and for humans.

## The owner's decisions on rules

Each rule lives in exactly one place:

1. **Rules for any project using Naima**: one rules page in the human docs,
   each rule marked "enforced by <check or gate>" or "convention". The flows
   link to it; the skill and `AGENTS.md` point to it and never copy it.
2. **Rules only for developing Naima itself** stay in `AGENTS.md`.
3. **A project's own rules** become tracker data in its `naima-data/` (a
   separate feature, on its own branch); this page only points to it.

## Done means

- `docs/README.md` is a map: who you are, where to start.
- `docs/guide/` is for people and assumes no code: a tutorial run for real
  from an empty git repository (install, init, file a bug, triage, board and
  queue, fix, prove with a test item, close), with every command's real
  output; how-to pages by task (report a bug, file a feature, triage, read
  the board, queue and gates, prove and close, several branches at once,
  update Naima, configure the project, add a plugin someone gave you, work
  with AI agents as a person); concepts, the single rules page, install,
  configuration, FAQ, and a glossary that defines every term once.
- `docs/agents/` is for agents: the flows, the skill, how an agent learns a
  project, and pointers to the rules page, never copies.
- `docs/reference/` holds the format and the generated reference; the purpose
  page stays first.
- `docs/develop/` is for people changing Naima's code: architecture, plugin
  contract, the documentation rule (documented for people in the guide, for
  agents in the agent pages, and in the reference generated from the
  manifests), and how Naima tracks itself.
- Every link in `README.md`, `AGENTS.md`, `skills/`, `site/llms.txt`, `src/`
  (strings that print doc paths, such as `naima guide`), the tests and the
  dist allowlist (`dist.json`) follows the move; no historical narrative; no
  bare identifier.
- A test keeps every relative link in every markdown file resolving.
- `deno task verify` passes, and the tests pass on Node and Bun.

## How it is proven

The owner reads the tutorial and the guide (a tests item, `runBy: human`,
because how documentation reads is a judgement).
