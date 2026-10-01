# Questions

## Do I need to read or write code to use Naima?

No, nor know git or project management. An AI agent runs the `naima`
commands and git for you; you say what you want in plain words and decide
what is yours to decide ([working with AI agents](working-with-agents.md)).
If you like, everything in [the guide](README.md) can also be done by hand,
with `naima` commands and plain text on an [item](glossary.md#item)'s page.

## Is Naima only for software?

No. It runs anything that benefits from keeping every version: software, a
scientific data analysis, a paper written with colleagues, or several at once
in one project. Today's item types are shaped for software, but a bug such as
"figure 3 uses last year's data" fits them already; packs of item types for
other work are [planned](../planned.md#item-types-for-other-work).

## Is there a web page with the board?

No: Naima has no server and no account. The board is `naima board <type>`,
and `naima summary --markdown` prints the state of the project as markdown
you can paste anywhere. A visual dashboard is
[planned](../planned.md#design-skills-and-a-dashboard).

## Where is my data? Does anything leave my machine?

In `naima-tracker/naima-data/`, as plain files in your repository, committed
with your work. What you say to an agent in chat is not copied there without
your yes ([the rule](rules.md#the-owners-chat-stays-private)). Naima itself never uses the network; git does, only to fetch
Naima when it is first installed or updated
([the permissions](install.md#the-permissions)).

## Can I edit the files by hand?

An item's page, `README.md`, and its `attachments/`: yes, that is how you
write them. Its fields, `meta.json`: no — use `naima set`, `naima link` and
the other commands ([the rule](rules.md#change-the-tracker-only-through-the-cli)).
The configuration, `naima.json`: yes, by hand
([configure the project](configure-the-project.md)).

## Why won't Naima close my item?

Closing needs the fix and a [proof](glossary.md#proof) that passed. `naima close` says which is
missing; [prove and close](prove-and-close.md#4-close-it) lists every reason.

## Why does `naima check` fail after I pulled?

Usually one of:

- someone updated Naima and your branch has items in the old format (the
  check `one-format`): merge the [trunk](glossary.md#trunk) and run `naima update`
  ([update Naima](update-naima.md#on-a-branch-opened-before-the-update));
- `naima.json` now names a different source: review why, then
  `naima update --accept-source`;
- a real problem in the data: the line says which item and what.

## "Fixed" and "closed" — what is the difference?

Fixed: the code exists. Resolved: fixed, and proven. Closed: resolved and
archived. Three states, three numbers, never added together
([concepts](concepts.md#fixed-resolved-closed)).

## The program folder appeared in my repository. Is that right?

`naima-tracker/naima/` is the copy of Naima your project runs. Git ignores
it; `git status` never shows it. Some tools that ignore `.gitignore` may
read it: [keep Naima out of your own tools](configure-the-project.md#keep-naima-out-of-your-own-tools).

## Who updates Naima?

Whoever runs `naima update`, as one commit — usually an agent at the start
of a session. Nothing updates by itself ([update Naima](update-naima.md)).

## Can two people, or two agents, work at once?

Yes, each on its own branch and [worktree](glossary.md#worktree); claims and [session notes](glossary.md#session-note) are files
of each branch's own, so nobody edits the same file
([work on several branches at once](several-branches.md)).

## Does it work on Windows?

It installs and runs there (`install.ps1`), but Naima's automated tests run
only on Linux and macOS.

## How do I stop using Naima?

Delete `naima-tracker/` and commit. Nothing else in the project was changed,
unless you asked `naima init --write-excludes` to add its exclusion lines to
your tool configurations; remove those too.

## Can I change Naima itself?

Yes, that is encouraged: in your own copy of its repository (a
[fork](glossary.md#fork)), never inside `naima-tracker/naima/`
([modifying Naima](install.md#modifying-naima)).

## A word I do not know

[Glossary](glossary.md).
