# `naima note` and a description-edit command — one command per agent action

Triage is done by an agent and includes rewriting the description and commenting, but the CLI has no command to edit an item's description or add a dated, attributed comment — only fields via `set`/`triage set` and `link`.

Done: `naima note <item> "..."` appends a dated, attributed, append-only comment; a description-edit command exists and is used by the triage flow instead of a hand edit; the triage flow page lists both steps; an audit confirms every other action an agent takes on an item already has a command, or files the gap as its own item.
