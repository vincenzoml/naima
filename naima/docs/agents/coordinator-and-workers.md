# The coordinator and the workers

How a session is staffed when agents do the work. It does not replace
[worktree isolation](worktree-isolation.md): that says what may be written
where; this says who does what.

## The shape

**One coordinator. Every piece of work in a background worker. The
coordinator does not do the work; it holds the conversation.**

```
          owner
            │  one question at a time, answers, decisions
            ▼
      COORDINATOR ── holds any locked resource (a running app, a device)
            │
            ├── worker ── own worktree, own branch ── reports ──┐
            ├── worker ── own worktree, own branch ── reports ──┤
            └── worker ── own worktree, own branch ── reports ──┘
                                                                │
                                  git merge --ff-only ◀─────────┘
```

### What the coordinator does, and only this

- Talks to the [owner](../guide/glossary.md#owner) — **one question at a time**, and only questions that
  are the owner's ([asking the human](asking-the-human.md)).
- Holds whatever only one actor may drive at a time: a running application, a
  device, a deployment. A worker never drives it unless it is handed over
  explicitly, and then the coordinator does not touch it until the worker
  reports.
- Spawns workers, merges their branches, and keeps the queue honest.
- Sets a timer that brings it back when nothing else will. The owner should
  never be the reason work resumes. A fuller method — an explicit target
  written first, a three-minute wake-up, stopping only when what is left is
  the owner's, and the owner's ordered action list as the deliverable — is
  [planned](../planned.md#the-non-stop-method).

### What a worker gets

Everything it needs to work without asking, because it cannot ask:

- **its own worktree** off the [trunk](../guide/glossary.md#trunk), its own branch, and its dependencies
  installed (a fresh checkout has none);
- **the item already filed** — a worker reads a tracker page, it does not
  invent scope — and it claims what it takes (`naima claim`);
- **what is already measured**, stated as given, so it does not re-derive it:
  the single biggest saving available;
- **the gates**, with their current numbers, to run at the end;
- **the constraints**: which resources it may not touch, that it does not
  commit on the trunk or touch another [worktree](../guide/glossary.md#worktree), which sibling branches'
  files it must stay out of;
- **no sub-agents of its own.** A worker that spawns workers loses all of
  their work when it stops.

## The jobs

| Job | Owns | Refuses |
|---|---|---|
| **Coordinator** | the conversation, locked resources, the timer, spawning and merging | work a worker could do; more than one question at a time |
| **Lead developer** | the queue: sweeping fixed-but-unproven [items](../guide/glossary.md#item), preparing branches, the merge train | merging without the [gates](../guide/glossary.md#gate); closing an item on reasoning; closing its own branch's items |
| **Implementer** | one item, one cause, one branch | widening scope; spawning workers; touching the trunk |
| **Tester** | performing gestures on the running software and writing down what happened | fixing what it finds; testing what it just wrote |
| **Filer** | classification, [triage](../guide/glossary.md#triage) fields, reports routed to the right tracker | inventing scope; deciding whether something is proven |
| **Evidence owner** | whether a gesture proves the claim | performing the gesture it then judges |

Work passes between them in one direction:

```
report ─▶ filer files it ─▶ lead developer triages and ranks
                                    │
                                    ▼
                      implementer fixes it (own worktree)
                                    │
                                    ▼
          lead developer sweeps, runs the gates, merges ─▶ trunk
                                    │
                                    ▼
             tester performs the gesture ─▶ evidence owner closes it
```

Nothing skips a step by being obvious. The two arrows that look skippable —
naming the gesture for a fix, and judging a gesture someone performed — are
where work gets lost.

### The lead developer's three jobs

1. **The sweep.** Items whose fix already landed but whose [proof](../guide/glossary.md#proof) was never
   linked. Read the board against the code, mark what is already fixed, and
   name the gesture that would prove each one as a test item linked
   `verifies`. Without the sweep, several sessions each open the same item and
   each discover it is already fixed.
2. **Preparing branches** for a clean fast-forward: the trunk merged in
   first, the gates run over the combined result, claims released, session
   note written ([closing a worktree](closing-a-worktree.md)).
3. **The merge train.** Finished branches merged in order, gates between,
   `--ff-only` at the end. If it refuses, stop.

It never merges without the gates, never closes an item on reasoning ("the
code clearly does this now" is a diagnosis, not a measurement), and never
closes its own branch's items.

### The tester and the resource holder are different actors

An actor that both drives the software and writes the assertion cannot tell a
fact about the software from the current state of something editable — to it
they are one motion. Keep them apart: the tester prepares or performs the
gesture, the evidence owner judges it.

## Choosing the model

**A worker's model is a parameter, and choosing it is the largest saving
available.** Use the strongest model for diagnosis and design, where being
wrong costs a day; a faster, cheaper one for filing, triage, classification,
merges, audits and running gates.

## How many at once

**Two** as the standing number; up to **four** only for short, cheap, parallel
work. Concurrency is bounded by the budget as much as by the load: too many
expensive workers at once exhaust it and die mid-task.

**When a worker dies, salvage before respawning.** Its worktree still holds
everything it had not committed. Separate the work from mechanical churn,
commit the work as WIP marked unreviewed, and hand the replacement that commit
to read rather than a blank start.

## Gates run after a batch, not after every commit

A worker commits freely — small commits, one idea each — and runs the full
gate set once per batch. If the batch comes back red, `git bisect` over its
own commits finds the culprit, which is what small commits are for. Commit
before running the gates, so a red gate never costs uncommitted work. A branch
is never reported done on an unrun gate set.

## Reporting

Workers report to the coordinator, never to the owner. The coordinator's
reply has a fixed order:

1. **what changed** — the work, in its own words, a line or two;
2. **the number** — the queue after the change (`naima queue`), which may go
   up, and that is why it is announced;
3. **what the owner must decide** — one question, or nothing.

Never a preamble, never the number before the work, and never a restatement of
what was just committed or filed: if it is worth explaining, it is worth
committing.
