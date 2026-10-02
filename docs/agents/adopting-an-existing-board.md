# Adopting an existing board

When a project that starts using Naima already keeps its work in a file — a
`TODO.md`, a notes file, an issue list in markdown — bring it in with
`naima adopt`, never by retyping it: a report retyped is a report that can be
lost. The person's guide is [adopt an existing board](../guide/adopt-an-existing-board.md);
this page is the procedure.

## The procedure

1. **Claim and branch** as for any work ([opening a worktree](opening-a-worktree.md)).
2. **Propose**, and read the dry run: `naima adopt propose <file>`. Then
   `--write`, and read `git diff <file>`: it must add lines and delete none.
   Fix the markers by hand where the guess is wrong — a type, a key, a
   status, a pair that cuts one item in two. Commit the marked file on its
   own, so the items' `adoptedFrom` names a commit.
3. **Split**: `naima adopt split <file>`, then `--write`. Commit the new
   items and `naima-data/adopted/<file>.json` together.
4. **Audit**: `naima adopt audit <file>`. It exits 1 while a line of any
   committed version is carried by no item and no board prose. Each one is
   either carried — put back in the file and adopted, or written into an
   item by hand — or reported to the owner as a decision; never dropped
   silently.
5. **Links**: `naima adopt links <file>`. Write only the proposed ones
   (`--write`), which rest on a real commit both items name and shared
   wording. The rest — shared commit or shared wording alone, gate
   candidates — goes to the owner as a list to decide
   ([asking the human](asking-the-human.md)); never link or declare a gate
   on wording alone.
6. **Triage** the new items like any others ([reporting and triage](reporting-and-triage.md)).

## Never

- Delete, empty, move or rewrite the source file: retiring it is the owner's
  decision, once the audit says nothing is missing.
- Edit an adopted item to match a later change in the source: `split`
  reports the change; carry it with `naima note` if it matters.
- Edit the record in `naima-data/adopted/`: it is what proves the
  round trip.
