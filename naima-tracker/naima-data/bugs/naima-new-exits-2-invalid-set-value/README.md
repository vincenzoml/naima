# naima new exits 2 on an invalid --set value, yet leaves the item it refused behind

## Observed (measured, 2026-10-01, the locked Naima on branch claude/pages)

```sh
deno task naima new tests "The project site looks right to the owner, and its installers work on Windows" \
  --set runBy=human "--set" "humanBecause=how it looks is the owner's call; ..."
# naima: humanBecause: "how it looks is ..." is not one of: judgement, decision, credential, physical
# exit 2
```

The directory `tests/project-site-looks-right-owner-installers-work/` was
written all the same (README.md, meta.json with status `open`, no
`runBy`/`humanBecause`), and showed up only at `git status`. It is kept,
withdrawn, as the evidence.

## Consequence

Whoever retries with a valid value gets two items: the refused one, open and
untriaged, and the right one. An agent that trusts the exit code never knows.

## Inferred, not checked

The validation of `--set` values runs after the item is written, not before.
