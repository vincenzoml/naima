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

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: withdrawn as a duplicate of bugs/naima-new-set-bad-fails-but-leaves (already fixed; today's repro left no item behind). Leaving status as-is for the evidence owner to close.

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Duplicate of the closed bug about naima new --set leaving a half-made item, which was fixed and proven before U8 (papercuts session note). Linked duplicate-of it; the twin keeps the evidence. Set to wontfix: nothing left to fix here.
