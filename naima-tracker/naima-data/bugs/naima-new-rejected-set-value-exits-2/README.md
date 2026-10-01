# naima new with a rejected --set value exits 2 but leaves the item it refused on disk

## Seen

On 2026-09-30, on branch claude/purpose-doc:

```sh
naima new tests "<title>" --set runBy=human --set "humanBecause=<free text>"
```

exits 2 with `humanBecause: "<free text>" is not one of: judgement, decision,
credential, physical`, yet `tests/<slug>/` was written (README.md, meta.json
with id, title, status, created; none of the --set fields). Rerunning the
corrected command created `tests/<slug>-2/`, and `naima check` then noted the
two as possible duplicates.

## Expected

A refused `new` writes nothing: validate every `--set` before creating the
directory, or remove it on failure.

## Proving gesture

A test: `naima new` with an invalid `--set` value exits 2 and the tracker's
item count is unchanged.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

U4 proof run: withdrawn as a duplicate of bugs/naima-new-set-bad-fails-but-leaves (same underlying bug, same fix). Leaving status as-is for the evidence owner to close.

### 2026-10-01 — Vincenzo Ciancia, on claude/u10-proof-integrity

Duplicate of the closed bug about naima new --set leaving a half-made item, which was fixed and proven before U8 (papercuts session note). Linked duplicate-of it; the twin keeps the evidence. Set to wontfix: nothing left to fix here.
