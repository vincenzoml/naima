# Update Naima

A project runs one exact copy of Naima, the [lock](glossary.md#lock) in
`naima.json`. It changes only when someone updates it, as one commit
([the rule](rules.md#update-deliberately-as-one-commit)).

## Is there a newer Naima?

```sh
naima update --check
```

It prints whether the [source](glossary.md#source) has moved past the lock,
and exits with 1 when it has. Nothing changes.

## Update

```sh
naima update
naima check
git add naima-tracker && git commit -m "Update Naima to <commit>"
```

`naima update` fetches the newer Naima, moves the program to it, rewrites the
data to a newer [format](glossary.md#format) when there is one (a
[migration](glossary.md#migration)), and records the new commit. A failed
update leaves the previous program in place. Review the change like any
other, and commit it.

If agents work on the project, updating at the start of a session is their
job ([the Naima skill](../agents/skill.md)).

## When a teammate updated

Pull their commit and run any `naima` command: it notices the lock moved,
says `naima: locked commit moved <a> → <b>` once, and follows it.

### On a branch opened before the update

`naima check` fails with `one-format` when a branch's new items are in the old
format and the trunk's in the new one. Merge the trunk into the branch, then
run `naima update` again: it finishes the migration of the branch's items, or
does nothing.

With several branches open, update on a branch of its own and merge it first.

## When `naima.json` names a different source

If a pulled `naima.json` names another repository — someone switched to a
fork — every command refuses to run it, naming both. Find out why it changed,
then:

```sh
naima update --accept-source
```

## What can go wrong

| Naima says | Do |
|---|---|
| the program directory has local changes, or commits its source does not have | someone changed Naima in place: publish the change as a fork and set `source` ([modifying Naima](install.md#modifying-naima)) |
| it cannot reach the locked commit | the source was rewritten or deleted: point `source` at a repository that has it |
| no network, and no copy yet | connect once; after the first clone every run works offline |

Everything about the lock, alignment and the dist branch: [install](install.md).
