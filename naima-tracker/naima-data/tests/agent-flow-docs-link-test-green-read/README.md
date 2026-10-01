# Agent flow docs: link test green, read-through checklist covers report shape, commit contract, stash hazard, role refusals, safety-rule statements

Proves the five D1 docs items by gesture, not reasoning.

## Gesture 1: the link test

```sh
deno task verify
```

Green run, this session: 247 passed, 0 failed. Includes "every relative link
in every markdown file of the repository resolves" and "every page of
naima/docs/agents/ is linked from its index" — both passed, covering every
new and edited page below.

## Gesture 2: read-through checklist

Read each page and confirm:

- [ ] `naima/docs/agents/worker-protocol.md` states the report shape (what
      changed, red shown before green, gate numbers, queue, one question),
      the file-overlap rule, and that finished workers are merged together
      rather than one at a time.
- [ ] `naima/docs/agents/commit-messages.md` states one-commit-one-thing, the
      subject names the effect not the function, the body says what was not
      verified live, and that a human-verdict token is never written by an
      agent.
- [ ] `naima/docs/agents/worktree-isolation.md` has "The shared-stash hazard"
      section: prefer a WIP commit, apply a stash by sha, never bare `pop`,
      never stash to measure a baseline while a resource is running.
- [ ] `naima/docs/agents/plan-with-epics-and-gates.md` and
      `naima/docs/agents/coordinator-and-workers.md` each state a role's
      refusal in one line (gate/epic status never set by hand; a worker
      never merges; a branch never closes its own items).
- [ ] Each of `worker-protocol.md`, `commit-messages.md`,
      `worktree-isolation.md`, `closing-a-worktree.md`,
      `opening-a-worktree.md`, `coordinator-and-workers.md`,
      `asking-the-human.md`, `the-non-stop-loop.md`, `git-for-the-owner.md`,
      `reporting-and-triage.md` carries a "Safety rules" section, each
      statement marked enforced, convention or candidate property for a
      later model.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/d1-agent-docs

Performed: deno task verify green (247 passed, 0 failed), link test and agents-index test included. Read-through checklist: all 5 checked, every named page carries its section.
