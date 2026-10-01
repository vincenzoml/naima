# Renaming an item keeps its page's title line in step

Found by the audit of agent actions on an item (features/naima-note-description-edit-command-one-command). `naima set <item> title="..."` changes the title in `meta.json` only; the `# ` line of the item's `README.md` keeps the old title, so an agent edits it by hand.

Done: changing the title rewrites the page's title line in the same write, through the write hooks, and a test shows the two agree after a rename.
