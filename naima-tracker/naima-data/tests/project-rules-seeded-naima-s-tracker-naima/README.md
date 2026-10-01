# Project rules: seeded on Naima's tracker, naima rules and naima guide show them, the check holds

Performed on the trunk, after the rules plugin is merged, pushed, and the lock
moved to it (`deno task naima update`).

1. From the repository root, run the seed attached to the feature
   (`features/project-rules-as-tracker-data-rules-type/attachments/seed-rules.sh`):
   five rules items appear under `naima-tracker/naima-data/rules/` — quiet
   mode, simple mode, fast mode, reporting, irreversible actions.
2. `deno task naima check`: all invariants hold.
3. `deno task naima rules --audience agents`: the five rules, each `MUST ·
   agents`, with its text and its `Why:` line — the same text as the seed's
   dry run (`attachments/seed-dry-run.txt` of the feature).
4. `deno task naima guide`: those rules are printed first, before the
   documentation pages.
5. Negative half: blank one rule's page (keep only its title) and run
   `deno task naima check`: it fails naming that rule, "an active rule with no
   text". Restore the page.
6. Commit `naima-tracker/` as one change.

## Result

Not yet performed. On the branch, the dry run on a copy of the tracker
(working tree, `deno task dev`) seeded the five rules and printed them; the
behaviours are tested in `src/plugins/rules/rules.test.ts` and
`src/cli.test.ts`.
