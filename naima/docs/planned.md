# Planned

Everything the documentation describes that Naima does not do yet, in one
place. Every other page says "planned" in one phrase and links here. Nothing
on this page exists in this version: `naima help` and `naima types` list
what does, and [what Naima is for](purpose.md#what-exists-today) sums it up.

Each entry says what it is, what you can do today instead, and an example.
The order is the order of the work: the first entries come first.

## Metrics

- **Code-quality metrics side by side with tests**: measures of the code
  itself, read next to the test results, so a change that passes its tests
  but makes the code harder to maintain is seen.
- **Metrics measured on every commit without anyone asking**: a commit hook
  that runs them and records the numbers, and a trend drawn as a chart on a
  dashboard.
- **Today:** `naima metrics run --record` runs the project's metrics when
  asked, records them per commit, holds each to a budget, a floor or a
  baseline, and `naima metrics trend` draws the trend as text
  ([metrics and budgets](guide/metrics-and-budgets.md)).

## Model checkers and the strength of evidence

- **Real [model checkers](guide/glossary.md#model-checker) as verifiers**:
  mCRL2 first, VoxLogicA (a tool for checking properties of images) where it
  applies.
- **The mCRL2 model of Naima's own claims** ("no claim is ever lost") as a
  property in Naima's own tracker.
- **A check for red-then-green**: a test must be shown to fail on the old
  work and pass on the new.
- **A written order of how strong each kind of evidence is**: a run beats a
  reading of the code, a measurement beats a report.
- **Today:** properties, `naima verify` and expiring proofs work, with one
  example verifier, `naima/src/plugins/verifier/adapters/example-regex.ts`
  ([prove and close](guide/prove-and-close.md#properties-proven-by-a-tool)).

## Structuring a project from the start

An [epic](guide/glossary.md#epic) of its own for the first decisions: which
language or languages, splitting the work into small independent parts,
keeping logic separate from data. Example: data in plain files, one script per
table, no number typed by hand into the paper. **Today:** the agent proposes
these choices in chat, and the owner's answers become
[project rules](guide/write-a-project-rule.md).

## Design, skills and a dashboard

- **Designing what users see**: support for planning and checking a user
  interface.
- **Skills from GitHub**: an item or flow points to a
  [skill](guide/glossary.md#skill) published on GitHub instead of copying it.
- **A dashboard**: a visual page of the project's state. **Today:** `naima
  summary --markdown` prints it as text you can paste anywhere.

## A pointer in the agent's instruction file

`naima init` offering, when asked, to add one line to the project's agent
instruction file (such as `AGENTS.md` or `CLAUDE.md`) pointing at the
[skill](agents/skill.md). **Today:** the installer's instructions tell the
agent to do it ([working with AI agents](guide/working-with-agents.md#get-an-agent-going)).

## Item types for other work

Naima is born for software; these are packs of item types for other work
([beyond software](purpose.md#beyond-software-any-project)): experiments and
analyses whose evidence is a reproducible run; sections and reviews of a
paper.
**Today:** bugs, todos, features and tests fit most of this already ("figure
3 uses last year's data" is a bug), and a project can add its own types with
a [plugin](guide/add-a-plugin.md).

## Roles

The jobs in [the company of agents](purpose.md#the-company-and-its-roles)
not yet written as practice:

- **Release manager**: proposes a release when the gates hold; never decides
  it.
- **Documentarian**: writes the documentation with the feature. The rule it
  serves is already a check
  ([features are documented](guide/rules.md#features-are-documented-as-part-of-their-implementation)).
- **Announcer**: release notes, changelog, site, announcements, only for
  what shipped and was checked.
- **Business**: options for licence, funding, sponsorship and adoption, for
  the owner to decide.
