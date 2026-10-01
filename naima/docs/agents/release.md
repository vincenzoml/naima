# Release

An external build cannot be recalled. This page is the runbook that stands
between a [gate](../guide/glossary.md#gate) going green and the world seeing
the result, and the role that runs it: what its queue is, what it owns, what
it refuses, and where it hands off.

**Calibrated for open source**: there is no support contract, no paying
customer to notify first, and no embargo beyond what a security advisory
asks for. A release is a tag, an artefact and an announcement; the runbook
below exists so none of the three happens before the one before it is true.

## Queue, owns, refuses, hand-off

- **Queue**: a [gate](plan-with-epics-and-gates.md) that holds, with nothing
  open on it — `naima gates --check` says so. Nothing is released off a gate
  that does not hold.
- **Owns**: opening the `releases` item, running every stage in order,
  recording each stage's output, and the single question to the owner (the
  [decision](../guide/glossary.md#decision) to ship) that this role never
  answers itself.
- **Refuses**: judging whether the code is good enough — that was the gate's
  job, met before this role starts — and announcing anything not yet true.
- **Hand-off**: to the [documentarian](documentarian.md), for the page that
  tells people the release happened, once it has.

## Proposing a release

1. Find a gate that holds: `naima gates --check`; `naima gate show <name>`
   for one by name. A gate that does not hold is not proposed.
2. Build the changelog from what the gate's [epic](../guide/glossary.md#epic),
   or the gate itself, closed since the last release: `naima list <type>` for
   each type the gate touches, kept to the items whose `closedOn` falls after
   the previous release's date (`naima show <previous release>` carries it in
   its Notes). One line per item, in the owner's language, not the item's
   title verbatim — a changelog reads to a user, a tracker item reads to an
   agent.
3. Open the trace item at its first stage and propose the release to the
   owner, changelog attached:
   ```sh
   naima new releases "<name or version>"
   naima describe <release> --file changelog.md
   naima decisions release   # has the owner already said go for this gate?
   ```
   Without a standing decision, ask once, one question
   ([asking the human](asking-the-human.md)): "the gate holds, here is the
   changelog — ship it?" Record the answer: `naima new decisions "…"`,
   linked `settles` to the release.

## The runbook

The release item opens `staging`, at its first stage; `naima view releases`
shows what it still owes. Each stage's output is recorded with
`naima note <release> "Stage: <name>\n<what happened>"` before the next one
starts — and a stage skipped on purpose names who decided:
`Stage: <name> — skipped, decided by <who>`. A write that asks for
`status=released` while a stage is unrecorded is refused by the project
(`release-stages`, in `naima/src/plugins/planning/index.ts`): the check
derives what it expects from the repository — the gate's state, the tag that
does or does not exist yet, the build that did or did not run — never from
what the stage's own runner claims happened.

1. **Pre-release checks.** The gate still holds (things move between
   proposing and running the runbook); `naima check` and the project's full
   gate set are green from a clean checkout, not the worktree that has been
   edited all afternoon.
2. **Private draft.** The artefact is built and placed somewhere only the
   release role can see it — a draft release, an unlisted build — never the
   public location yet.
3. **Test the artefact, not the code.** Install or run the thing that was
   built, not the source it came from: a build step can silently drop a file
   the tests never touched. The gesture is written down as it would be for
   any [proof](../guide/glossary.md#proof) — what was run, on what, what
   appeared.
4. **Issues found → stop.** Any of the three stages above finding a problem
   ends the runbook there: open the bug, loop back to stage 1 once it is
   fixed. A runbook that "mostly worked" is not published.
5. **Publish.** The tag, the public artefact, the public draft made visible —
   whichever the project's distribution is. This is the irreversible step:
   confirm with the owner first if it was not already covered by the
   decision in step 2 of proposing.
6. **Post-release checks.** The public thing is fetched or installed from
   where a stranger would get it, not from the build directory.
7. **Announce only what is true.** The changelog goes out once, after step 6
   passed — never before, on the assumption it will. Hand off to the
   [announcer](announcer.md), who writes it from `naima announce --gate
   <gate>`: only the features that are announceable, and the
   [documentarian](documentarian.md) for the page itself.
8. **Rollback.** Available from any stage from publish onward: the tag is
   not force-moved, a fixed point is published instead (`vX.Y.Z+1`, never a
   rewritten `vX.Y.Z`), and the item records why, as `Stage: rollback`.

Whoever wrote the code does not run the runbook on their own branch's
release: the gate already enforces that the merge was someone else's call;
this role performs the runbook, it does not re-argue the gate.

## Safety rules

- **Nothing is released off a gate that does not hold.** Convention: `naima
  gates --check` before stage 1, every time.
- **A release is never marked done with a stage unrecorded.** Enforced by
  the `release-stages` write hook and its check counterpart in
  `naima/src/plugins/planning/index.ts`.
- **Announcing precedes nothing it depends on.** Convention: step 7 runs only
  after step 6 passed, never in parallel with it.
- **A rewritten tag is never published as a fix.** Convention: rollback ships
  a new version, never force-moves the old one.
