# Commit messages

What a commit message must say, so the [owner](../guide/glossary.md#owner) —
who reads messages, never diffs — can tell what changed without opening the
code, and so a later reader can tell what was actually run against the
software from what was only written. This page is the contract;
[git, handled for the owner](git-for-the-owner.md) is the wider practice it
sits inside.

## One commit does one thing

A commit that mixes an unrelated rename with a fix cannot be undone on its
own. Small commits, one idea each — already
[the practice](git-for-the-owner.md#4-use-git-so-nothing-is-ever-lost); this
page is about what the message then says.

## The subject says what changes, not which function moved

The owner cannot read a function name and know what they can now do that
they could not before. Write the effect:

- not "refactor `claim()`" — "a claim file now survives a crash mid-write"
- not "update docs.md" — "the triage page explains `effort` before `impact`"

## The body says what was not verified live

A message that only lists what was done, with no mention of what was not
checked against the running software, turns into a false "done" the moment
someone reads it later and assumes silence meant everything was tried. When
anything was written but not run — a path not exercised, a case reasoned
about rather than seen failing then passing — the body says so, in plain
words, every time it applies. No news is not good news here; it is a gap the
message must name.

## Tokens reserved for the human verdict

A commit records what an agent did and measured. It never writes the words
that mean a person judged the result — "approved", "looks good", "signed
off" — because an agent did not perform that judgement, and a message that
reads as if it did misleads the next reader into skipping the step. Those
tokens appear only in a [decision](../guide/glossary.md#decision) item or a
note attributed to the owner, never typed by an agent into a commit body.

## The records that go with a change, in the same commit

A record written "later" is never written: a fix with no test to prove it, a
change with no note. A project's companion rules say which records a change
must carry in the commit that makes it ([commit hooks](../guide/commit-hooks.md)).
Before committing a tracker write:

1. `naima hooks` lists the companion rules — the built-in one is
   `fixed-has-test`: setting `fixedOn` comes with a linked verifying test.
2. Stage the change, then `naima check --staged`: each problem names the item,
   what it lacks, and the rule. Add the missing record to the same commit.

When the project has run `naima hooks install`, the pre-commit hook runs that
check by itself, on a commit that touches the tracker or a rule's paths and on
no other. `git commit --no-verify` skips it; a commit that does so says why in
its body.

The hook reads the staged files, never the message: a commit setting `fixedOn`
with no verified/not-verified line in its body is still caught only by reading.

## Safety rules

- **One commit does one thing.** Convention: [git for the owner](git-for-the-owner.md#4-use-git-so-nothing-is-ever-lost).
- **No human-verdict token written by an agent.** Candidate property for a
  later model: nothing yet greps a commit body for a reserved token: that
  check is filed as its own item, not built here.
- **The records a change requires are in its commit.** Enforced by the
  `companions` check (`naima check --staged`, and the pre-commit hook once
  installed): [commit hooks](../guide/commit-hooks.md).
- **A `fixedOn` commit with no verified/not-verified line is caught.**
  Candidate property for a later model: the pre-commit hook does not read the
  message; until a check does, read it.
