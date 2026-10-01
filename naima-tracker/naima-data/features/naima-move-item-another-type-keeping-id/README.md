# naima move: an item to another type, keeping its id and links

Found by the audit of agent actions on an item (features/naima-note-description-edit-command-one-command). An item filed in the wrong type (a bug that is a request) is today reopened as a new item and the old one linked `duplicate-of` it, which loses its id, links and history.

Done: `naima move <item> <type>` moves the folder, keeps the id and every link, refuses a status or field the new type does not declare, and runs through the write hooks.
