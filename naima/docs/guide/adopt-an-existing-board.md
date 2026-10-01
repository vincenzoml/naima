# Adopt an existing board

The project already keeps its work somewhere: a `TODO.md`, a notes file, an
issue list exported as markdown. `naima adopt` turns it into
[items](glossary.md#item) without retyping it and without losing a line.
Every step is a dry run until `--write`, and the file itself is never
deleted.

## Now

1. **Propose the boundaries.** Each top-level list item (`- `, `* `, `+ `,
   `1. `, with everything indented under it) becomes one item:

   ```sh
   naima adopt propose TODO.md            # what it would mark
   naima adopt propose TODO.md --write    # insert the markers
   git diff TODO.md
   ```

   The markers are HTML comments, invisible when the file is rendered:

   ```md
   <!-- naima: todos key=fix-login-redirect-loop -->
   - [ ] Fix the login redirect loop
     After the session expires the page reloads forever.
   <!-- /naima -->
   ```

   The diff adds lines and deletes none; `propose` refuses to write
   anything else. Read it and edit the markers by hand: the type (`todos`,
   `bugs`, `features`, …), the `key`, and `status=` (a ticked checkbox is
   proposed as `status=done`). Move, add or remove a pair to cut the board
   differently; a heading or a paragraph outside every pair stays the board's
   own prose.

2. **Split.** Commit the marked file first, so each item can name the
   commit it came from:

   ```sh
   naima adopt split TODO.md              # the items it would open
   naima adopt split TODO.md --write      # open them
   ```

   Each item's page is its segment, byte for byte, under a title line taken
   from the segment's first line. `section` is the nearest heading above it;
   `adoptedFrom` says where it came from — `TODO.md#L8-L9@<commit>`, or
   `working-tree` when the file was not committed. The board's own prose,
   and each segment's text as it was adopted, are kept in
   `naima-tracker/naima-data/adopted/<file>.json`: together they give the
   file back exactly.

3. **Audit.**

   ```sh
   naima adopt audit TODO.md
   ```

   It re-reads every committed version of the file, following renames, and
   lists each line that no item and no board prose carries, with the commit
   and line it was last seen on: a todo deleted months ago without being done
   shows up here. It also says whether the board still round-trips byte for
   byte. It exits 1 while anything is missing. Carry a missing line into an
   item by hand, or put it back in the file and run the steps again.

4. **Links, only on hard evidence.**

   ```sh
   naima adopt links TODO.md              # what it would link
   naima adopt links TODO.md --write      # write the proposed links
   ```

   A `relates-to` link is proposed only when both items name the same real
   commit of this repository and their titles share at least two words.
   Everything else is printed for you to decide and never written: a shared
   commit without shared wording, shared wording without a shared commit, and
   each command in a fenced shell block, as a candidate
   [gate](glossary.md#gate) — gates are declared in `naima.json`
   ([configure the project](configure-the-project.md)).

## Again, later

The file keeps living alongside the tracker. Run the steps again whenever it
grows: `propose` marks only list items outside every pair, and `split`
opens only keys not adopted yet. A segment whose text changed since it was
adopted is reported, never written over; an item someone edited is never
touched.

## What it does not do

- Delete, empty or move the file. Retiring it is your decision, once the
  audit says nothing is missing.
- Read an issue tracker's API: export the list as markdown first.
- Decide a link or a gate on wording alone.

Every option: [the reference](../reference/reference.md).
