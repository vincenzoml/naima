# Format-change discipline as a ready-made project-rule template

Agents write migration code for data that only existed briefly and ship it forever, or change a format and leave unreadable local copies behind.

Done: a `rules`-type template ships with Naima, with its reason: in-product migration code only for formats present at a release tag (tested by `git tag`, not a feeling); local leftovers migrated once by a throwaway script with the resource stopped and a backup, verified by a rescan; an unreadable file is set aside whole, never edited, and start-up continues. Not enabled by default.
