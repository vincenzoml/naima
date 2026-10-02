# Announcer

The role that tells the outside world what the project does: release notes, changelog entries, the site's and the README's copy, an announcement. It draws only
on what `naima announce` computes as announceable, so the project never promises what is not true.

## Queue, owns, refuses, hand-off

- **Queue**: a release handed off from [the release role](release.md) at its announce stage; items of kind `announcement` (`naima queue --role announcer`); a
  `copy-names-only-announceable` problem from `naima check`.
- **Owns**: the outward words: what the release notes say, in what order, and what the README and the site claim — written from `naima announce`, never from
  memory or from the branch names.
- **Refuses**: announcing a feature that is not announceable — user-facing, shipped, documented and checked by a person or end to end — and deciding _when_ to
  announce, which is the release role's, and before that the owner's.
- **Hand-off**: the page itself to [the documentarian](documentarian.md); a feature someone wants announced but that is not announceable goes back to the
  [lead developer's](coordinator-and-workers.md#the-jobs) queue with what it lacks, never announced on the promise it will be.

## What is announceable

`naima announce` computes it; nobody declares it. A feature is announceable when all four hold:

| It is           | Because                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **user-facing** | `facing=user`: someone using the software sees it; `facing=internal` is never announced                                                                                                                                                                  |
| **shipped**     | its status is `shipped` (the option `shippedStatuses`)                                                                                                                                                                                                   |
| **documented**  | its `docs` field names the page that documents it                                                                                                                                                                                                        |
| **checked**     | a passed item `verifies` it, run by a person (`runBy=human`) or by an agent driving the running software, end to end (`runBy=agent-hands`), or with the owner's gesture as evidence (`evidenceKind=owner-gesture`) — and nothing verifying it refutes it |

A unit test alone does not make a feature announceable: it proves the code, not that someone using the software gets what the copy says.

## Writing release notes

1. `naima announce --gate <gate>` for a release off a gate, or `naima announce --since <YYYY-MM-DD>` since the last one. Features marked `major=true` come
   first: lead with them.
2. `naima announce --all` adds every user-facing feature that is not announceable, each with what it lacks. Leave those out; hand off what they lack (above).
3. Write the notes in the project's words, one line per feature, from its title and its docs page. Nothing from the owner's chat goes in verbatim
   ([the rule](../guide/rules.md#the-owners-chat-stays-private)).
4. Before handing off, `naima check`: `copy-names-only-announceable` fails if the README, or any other file in the option `copy`, names by its label or its full
   title a feature that is not announceable.

## Safety rules

- **Only announceable features are announced.** Enforced for the copy files by `copy-names-only-announceable` (`naima/src/plugins/announce/index.ts`); for
  release notes, by convention: they are written from `naima announce`.
- **Announcing waits for the post-release checks.** Convention, held by [the release role](release.md): its announce stage runs last.
