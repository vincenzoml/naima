# Announce only what is true

What your project may tell the world — in release notes, the changelog, the README, the site — is computed from the tracker, never decided from memory. A
[feature](glossary.md#feature) may be announced once it is **announceable**: user-facing, shipped, documented, and checked by a person or end to end.

## Mark what a feature is for

Two fields, set on the feature when it is filed or later:

```sh
naima set features/search facing=user      # someone using the software sees it
naima set features/cache facing=internal   # only who works on it does: never announced
naima set features/search major=true       # an announcement leads with it
```

## See what may be announced

```console
$ naima announce
2 announceable
  ★ features/search  Search  (shipped 2026-01-10)
  · features/export  Export  (shipped 2026-01-12)
```

`★` is a major feature. `naima announce --since 2026-01-01` keeps those shipped (`fixedOn`) since a date; `naima announce --gate v1` those on a
[gate](glossary.md#gate), what a release off it announces. `--json` prints the same as data.

`naima announce --all` adds every user-facing feature that is not announceable yet, each with what it lacks:

```console
1 user-facing, not announceable
  ✗ features/sharing  Sharing — not documented: set docs=<path>[#heading]
```

A feature lacks one of four things:

| Lacks       | Fix                                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| user-facing | `facing=user`, if it is                                                                                                                                                                            |
| shipped     | it is not on the main branch yet: nothing to announce                                                                                                                                              |
| documented  | the page that documents it, named in `docs`                                                                                                                                                        |
| checked     | a [test item](glossary.md#test-item) that verifies it, passed, run by a person (`runBy=human`) or by an agent driving the running software (`runBy=agent-hands`) — a unit test alone is not enough |

## The README and the site

`naima check` fails when the README names a feature that is not announceable — by its label (`features/sharing`) or its full title. To hold the site's pages
too, list them in the option `copy`:

```json
"plugins": { "announce": { "options": { "copy": ["README.md", "site/index.html"] } } }
```

The agent that writes the announcements, and what it refuses, is [the announcer](../agents/announcer.md). Every option is in the
[reference](../reference/reference.md).
