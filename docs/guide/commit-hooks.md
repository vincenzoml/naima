# Commit hooks and companion records

A record written "later" is never written: a fix that lands with no test to
prove it, a feature changed with no note saying why. Naima holds such records
in the commit that makes the change — not in a review days afterwards.

## Companion rules

A companion rule says: when a commit makes this change, it also carries that
record. The change can be

- a file staged under a path (`"when": { "paths": ["src"] }`),
- any change to an item of a type (`"when": { "type": "features" }`),
- a field set to a new value (`"when": { "field": "fixedOn" }`), optionally on one type only.

The record it requires is exactly one of

| `requires` | holds when the same commit |
| --- | --- |
| `{ "type": "tests" }` | changes an item of that type (another one than the item that triggered it) |
| `{ "field": "commits" }` | leaves that field set on the item |
| `{ "note": true }` | changes the item's page — a `naima note` on it |
| `{ "link": "verified-by" }` | leaves the item linked by that relation, stored on either side |

A rule on paths has no item of its own, so it can require only a change to an
item of a type.

One rule is built in, **`fixed-has-test`**: setting `fixedOn` comes with a
linked verifying test. The project adds its own in `naima.json`:

```json
"plugins": {
  "commit-hooks": {
    "options": {
      "companions": [
        { "name": "fix-names-commits", "when": { "field": "fixedOn" }, "requires": { "field": "commits" } },
        { "name": "source-has-test", "says": "a source change comes with its test", "when": { "paths": ["src"] }, "requires": { "type": "tests" } }
      ]
    }
  }
}
```

`"builtin": false` switches the built-in rule off. A malformed rule stops
Naima loading, naming it — it never silently holds nothing. To write the rule
down for people as well, file it as a [project rule](write-a-project-rule.md)
with `enforcedBy` set to `companions`.

## Checking a commit before making it

```sh
git add -A
naima check --staged   # only the checks that read the staged change
naima hooks            # the rules, the watched paths, and whether the hook is installed
```

Each problem names the item, what it lacks and the rule, for example
`bugs/export-drops: no item is linked to it by verified-by — companion rule fixed-has-test: …`.
`naima check` runs the same rules too, over whatever is staged when it runs.

A move — `naima close` archiving an item — is one change of one item, not a
deletion and a creation: a field it already had does not trigger a rule again.

## The pre-commit hook

```sh
naima hooks install
git add naima-tracker/naima-data/hooks/pre-commit
git commit -m "Hold companion records in every commit"
```

`install` writes the hook into the data directory, where it is tracked like
the rest of the tracker, and sets git's `core.hooksPath` to that directory —
once per clone; every worktree of the clone shares the setting. Nothing
outside the tracker folder is written but that one key of the clone's git
configuration, written by git itself.

The hook is **path-scoped**: it starts Naima only when a staged file is under
the data directory or under a rule's paths. Any other commit costs one
`git diff` and nothing else. When it does start Naima, it runs
`naima check --staged`, and a problem stops the commit.

- `git commit --no-verify` skips the hook. It is allowed: say why in the
  commit message.
- A hook the clone already had in `.git/hooks/pre-commit` still runs, first.
- `core.hooksPath` already naming another directory (a tool of the project's
  own) is refused: those hooks would stop running. `--force` points it at
  Naima's anyway.
- `naima hooks uninstall` unsets `core.hooksPath` when it names Naima's
  directory, and leaves anything else alone.
- After changing the rules, run `naima hooks install` again: the hook-current
  check fails while the committed hook watches other paths than the rules name.

Every option is in the [reference](../reference/reference.md#commit-hooks).
