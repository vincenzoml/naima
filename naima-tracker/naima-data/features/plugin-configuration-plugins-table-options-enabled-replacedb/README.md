# Plugin configuration: a `plugins` table with options, enabled and replacedBy

## Behaviour

`naima.json` gains a `plugins` table keyed by plugin name (including first-party
plugins), each entry holding:

- `options`: the plugin's own documented options (for example `beta-markers`'
  scanner options, or the `docs` plugin's checker options) — reachable and
  honoured, unlike today where `src/builtins.ts` calls every first-party
  factory except `gates` with no options at all (`src/builtins.ts:16-18`).
- `enabled: false` to turn a plugin off.
- `replacedBy` to swap in a fork or alternative of a first-party plugin.
- Per-check severity: `checks: { id: "off" | "note" | "problem" }`, the way
  ESLint configures rule severity.

The top-level `gates` key, which is really a plugin's own setting living in
the core schema today, moves into this table under the `gates` plugin, with a
migration (depends on the per-plugin migrations feature, D-11).

## Boundaries

- `src/core/config.ts:99`, which today refuses a first-party name in
  `plugins`, is relaxed to accept configuration for first-party plugins too.
- The `reference-current` check (dead in every project today because its
  options can never be reached) becomes reachable and is exercised by at
  least one project-level test.
- Out of scope: this feature does not itself add new extension-point kinds
  (that is D-03) or qualified names (that is D-02); it only makes existing
  and first-party plugins configurable.

## Documentation

`docs/config.md` describes the `plugins` table shape and the `checks`
severity map; `docs/reference.md` is regenerated (`deno task docs`) to
reflect the new `naima.json` schema, including the migrated location of
`gates`.

Source: REVIEW.md section 2, decision D-01 (recommendation b); DECISIONS.md
line 1.
