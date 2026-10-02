# What happens while you are away

You can give agents a piece of work, leave, and come back to one short list
of what only you can do. Nothing else waits for you.

## Before you leave: name the target

Tell the agent what "finished" means. It is one of three things:

- **a list** — "tonight: merge the docs, rerun the checks, pick a licence";
  the agent writes it as an [item](glossary.md#item) with one line per step;
- **an [epic](glossary.md#epic)** — "the onboarding work";
- **a [gate](glossary.md#gate)** — "everything the beta waits for".

Without a target the agent will not start the loop: "keep going" is not a
target.

## While you are away

Every three minutes (you can ask for another interval) the agent wakes up and
asks itself: am I done, or did I stop? If work is left that an agent can do,
it resumes it — restarting a stopped worker, merging finished work after the
checks, starting the next piece. A step it cannot do now is not skipped in
silence: it is marked deferred, with the reason written next to it.

It stops only when everything left on the target is yours.

## When you come back

You get one ordered list. Each line says what to do and why it is yours:

```
the owner's actions, in order:
  1. bugs/pick-name  Pick a name — decision: a decision reserved to the owner
  2. tests/looks-right  Looks right — judgement: how it looks
```

Decisions come first, because they unblock the rest; then anything needing
your password or your hands; then judgements, such as whether something looks
right; then builds no agent can make.

If you are away longer, the agents do not sit idle: they try the checks
nobody has run yet and attach what happened, so that when you judge, the
evidence is already there.

To see the same list yourself at any time: `naima loop <target>`
([the reference](../reference/reference.md#naima-loop)). How agents run it:
[the non-stop loop](../agents/the-non-stop-loop.md).
