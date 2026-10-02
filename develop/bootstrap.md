# Naima tracking itself

Naima tracks itself, in `naima-tracker/naima-data/`. If the code in the
working tree managed that tracker, a bug in the checker could hide a bug on
the board, and a change to the item format could make the tracker's own
history unreadable. So the working tree never manages it. There is no special
case for this: Naima's repository uses exactly the model every project uses
([installing and updating](../naima/docs/guide/install.md)).

1. **The tracker is managed by the locked commit.** `naima-tracker/naima/` is
   a gitignored git clone of Naima's own repository, locked by `naima.json`
   to a commit of `main`, exactly as a project is
   ([the program](../naima/docs/reference/format.md#the-program)); that
   commit is the "previous version". `deno task naima <command>` runs it,
   through its own launcher, `naima-tracker/naima/naima.ts`; `deno task dev`
   names the data with `--data`, since a program finds its data beside
   itself. Alignment fetches the commit from this repository's own objects
   first, so it needs no network; a lock naming a commit of the old layout
   (the runtime in `naima/` rather than at the top) is moved by `naima
   update` to the head of `main`.
2. **The working tree is tested against the tracker, never its authority.**
   `deno task dev <command>` runs the working tree on the same data, and
   `deno task verify` runs `check` with both: the working tree as a test, the
   lock as the authority. The working tree never writes the tracker.
3. **The lock moves after the change is on `main`.** Once a change is merged,
   verified and pushed, `naima update` moves the lock to the new `main`, as
   one commit. A change the tracker is about to use — a new type, field,
   status or directory — is used only after that update.

The development files — `test/`, `develop/`, `AGENTS.md`, `.claude/`,
`.github/`, `deno.json`, `scripts/`, `site/`, and this tracker — are on `main`
only, outside the runtime folder `naima/`:
the locked program never holds them, so `deno task naima` cannot read
Naima's own items from inside its program directory by accident.

```sh
deno task naima check        # the locked commit, on this tracker
deno task dev check          # the working tree, on the same tracker
deno task naima update --check
```

## Why the reference is checked by the working tree

`docs/reference.md` documents the working tree's plugins, which the locked
commit may not have yet, and the launcher lets Naima write only under
`naima-tracker/`. So `deno task docs` writes the reference and `deno task
verify` checks it, both with the working tree, and the `docs` plugin holds no
reference file of its own by default.
