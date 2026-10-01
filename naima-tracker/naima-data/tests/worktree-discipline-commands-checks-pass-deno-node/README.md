# Worktree discipline commands and checks pass on Deno, Node and Bun

Run `test/plugins/coordination/worktrees.test.ts` on Deno (`deno task test`),
Node (`node --test`) and Bun (`bun test`). It was red before the
implementation and is green after it: `naima open` making the worktree
`<project>-worktrees/<what>`, the branch `<who>/<what>` from the trunk and the
claim in one step, and refusing a name off the scheme, an existing branch or
an unknown item before touching anything; the check `worktree-policy` failing
a worktree outside the directory or misnamed, a branch off the scheme, and an
unclaimed worktree with commits, while a fresh one, a claim on disk, a claim
released in the branch's own commits, and exempt branches pass; `claim
--preparing` noting trunk commits the branch lacks and naming those the
trunk's reflog records as direct commits, silent once merged; `prune --branch`
refusing unmerged work without an `archive/<branch>` tag, `--archive` making
it, and the trunk never pruned.

Negative half: on the real repository, `deno run -A naima/src/cli.ts check`
must fail a sibling worktree with unmerged commits and no claim, and stay
quiet about branches on the scheme.

## Notes

### 2026-10-01 — Claude, on claude/evidence-close-2

Evidence-close-2: ran test/plugins/coordination/worktrees.test.ts on Deno (5/5 pass), Node (--test, 0 fail) and Bun (5/5 pass). Logs: scratchpad/evidence-close-2/wt_{deno,node,bun}.txt.
