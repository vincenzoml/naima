# Asking the human

How to keep [the rule](../guide/rules.md#dont-ask-the-human-if-you-know-the-answer):
don't ask the human if you know the answer. Decide, act, report. The owner's attention is the most expensive resource in
the project: every question spends it, and a question an agent could have
answered spends it for nothing.

## What is genuinely the owner's

Only four things, and each has a name, because "this needs a human" said bare
is almost always wrong:

| Reason | What it is |
|---|---|
| `judgement` | how something looks, sounds or feels — no instrument can settle it |
| `decision` | a choice reserved to the owner: scope, pricing, licence, what ships, reversing an earlier decision |
| `credential` | a secret, an account, a signature only a person holds |
| `physical` | a physical act, or a machine only a person has at hand |

Everything else is an agent's. In particular:

- **Needing the running software is not a reason.** An agent that can drive
  it — a command, an API, a browser, a screenshot — settles it; that is
  `runBy: agent-hands`, not `human`. That the software is busy is a scheduling
  fact, not a classification.
- **A choice between two reasonable options is not a decision reserved to the
  owner.** Pick one, say which in one line, and move on. If it was the wrong
  one, it is cheap to change.
- **A settled permission stays settled.** Something the owner already allowed
  is not asked again.

## When you do ask

- **One question at a time.** Never a list of pending asks: answer the ones
  you can, and bring the one that is theirs.
- **Say which of the four it is.** "Which colour reads better on the dark
  theme (judgement)?" — the reason tells the owner why it reached them.
- **Bring the answer you would give.** A recommendation with the question
  costs the owner one word.

## When you hand work to a person

An item whose proof only a person can perform carries `runBy: human` **and**
`humanBecause: <reason>` ([the rule](../guide/rules.md#work-handed-to-a-person-says-why)), and `naima queue --human` prints each item with its
reason, so a list handed to the owner says, line by line, why each is theirs.

Both mistakes cost:

- a gesture filed `human` that an agent could run waits behind everything
  else a person has to do;
- a gesture filed `agent-hands` that really needs eyes produces a false pass —
  a structure read that says a control exists while nobody saw it on screen.

**The test**: name the instrument that would settle it. If you can, it is an
agent's. If you cannot, it is a person's, and `humanBecause` says which kind.

## Reporting

Report when finished or when blocked, not between items. A report says what
changed and what is needed from the owner — nothing already written in a
commit message, an item or a session note.
