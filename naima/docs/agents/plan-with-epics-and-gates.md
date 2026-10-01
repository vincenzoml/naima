# Planning: epics, milestones and gates

When the owner names a body of work, a release, or a date, turn the sentence into tracker data on the spot, through the CLI. Never edit `naima.json` or a
`meta.json` by hand.

| The owner says…                                                     | Run                                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| "these belong together", "the onboarding work"                      | `naima new epics "<title>"`, then `naima epic add <epic> <item>...`                                 |
| "that's a gate for the beta", "this must be done before we release" | `naima gate new <name> "<title>" --says "<what it is for>"`, then `naima gate add <name> <item>...` |
| "by the first of December", "for 0.9"                               | add `--due YYYY-MM-DD` and `--version <v>` to `gate new`                                            |
| "only when it is proven", "tested, not just written"                | add `--holds-on proof`                                                                              |
| "how far is the beta?"                                              | `naima gate show <name>`; `naima epic` for epics                                                    |

**Refusal:** whoever prepares a gate's items does not also mark the gate met.
A gate's and an epic's status is derived from its items, never set by hand —
so the one who did the work is never also the one who decides the release is
ready.

Rules that hold:

- **One gate per release or merge condition.** Before `gate new`, run `naima gates`: if one already means it, `gate add` to that one. A name is lowercase
  letters, digits, `.`, `-`, `_`.
- **Put the epic on the gate, not each item**, when the whole epic is what the gate waits for: `naima gate add beta epics/onboarding`. The gate then stands for
  the epic's items, and an item added to the epic later joins it.
- **An epic's status is derived.** Do not `naima set` it; close or remove its items. A write that sets it against them is refused.
- **A date is the owner's.** Do not invent a `--due`: ask, or leave it out ([asking the human](asking-the-human.md)). An overdue milestone is a `naima check`
  note; report it, do not move the date.
- **Commit what the commands wrote** — the epic's folder, the items, and `naima-tracker/naima-data/naima.json` — with the work that motivated it.

What each command prints and every option: the [reference](../reference/reference.md); for people,
[plan with epics, milestones and gates](../guide/plan-with-epics-milestones-and-gates.md).
