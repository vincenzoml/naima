# The Naima skill loads in an agent tool and its links resolve

## Gesture

1. Give an agent the skill (`docs/skill.md`), then start a session in a git
   repository with no `naima-tracker/` and ask it to start tracking the
   repository with Naima.
2. `naima check` in Naima's repository.

Pass: the agent tool lists the `naima` skill; the agent installs Deno if it
is missing, clones Naima into `naima-tracker/naima/` and runs `naima init`;
and `check` reports no broken link in `skills/naima/SKILL.md`.

*Gesture revised 2026-09-30 for the Deno distribution, which replaced `npx
naima init` and the clone-and-link install.*

## Result

2026-09-30, the author (agent): step 2 and the automated half pass —
`src/skill.test.ts` parses the front matter (`name: naima`, a description)
and finds every link resolving, `attachments/skill-test-2026-09-30.txt`.
Step 1 not yet performed.
