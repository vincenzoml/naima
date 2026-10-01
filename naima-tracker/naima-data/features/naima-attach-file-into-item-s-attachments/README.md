# naima attach: a file into an item's attachments, with the owner's consent recorded

Found by the audit of agent actions on an item (features/naima-note-description-edit-command-one-command): every action has a command except this one. An agent copies a file into an item's `attachments/` by hand, and nothing records whether the owner agreed to have their material stored there.

Done: `naima attach <item> <file>` copies the file through the write hooks; attaching the owner's material requires an explicit consent flag, recorded on the item, and is refused without it; docs for people and agents and the skill use it.
