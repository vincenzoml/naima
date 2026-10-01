# Document the 14 features proven without documentation

The U4 proof run (2026-10-01, branch `claude/u4-proofs`) found these 14
features with a passed, verifying test but no `docs` field — proven, not
documented. Each needs a docs page assigned ([the documentation rule](../../../../develop/documentation.md)) before it can ship.

- [ ] features/cross-branch-views-read-every-local-worktree — Cross-branch views read every local worktree's disk, local branches only
- [ ] features/declarative-extension-points-instead-12-hard-coded — Declarative extension points instead of 12 hard-coded kinds
- [ ] features/extending-another-plugin-s-types-fields-traits — Extending another plugin's types and fields: traits plus additive `extends`
- [ ] features/external-plugins-pinned-sources-contract-version-frozen — External plugins: pinned sources, a CONTRACT version, and a frozen registry
- [ ] features/lock-trust-policy-refuse-changed-source-verifiers — Lock trust policy: refuse a changed source; verifiers declare `runs`
- [ ] features/names-qualified-plugin-name-ids-short-aliases — Names: qualified plugin/name ids with short aliases and a rename map
- [ ] features/per-plugin-data-migrations — Per-plugin data migrations
- [ ] features/plugin-configuration-plugins-table-options-enabled-replacedb — Plugin configuration: a `plugins` table with options, enabled and replacedBy
- [ ] features/proof-currency-registry-level-predicate-plus-refutes — Proof currency: a registry-level predicate plus a `refutes` status flag
- [ ] features/slug-uniqueness-check-unmerged-local-refs-at — Slug uniqueness: check unmerged local refs at creation, uuid fallback
- [ ] features/triage-fallbacks-middle-impact-priority-worst-effort — Triage fallbacks: middle for impact/priority, worst for effort
- [ ] features/views-return-data-text-checks-gates-views — Views return `{data, text()}`; checks, gates and views may be async
- [ ] features/vocabulary-sharing-between-plugins-declared-uses-roles — Vocabulary sharing between plugins: declared `uses`, with roles as the target
- [ ] features/write-time-hooks-beforewrite-can-veto-afterwrite — Write-time hooks: `beforeWrite` (can veto) and `afterWrite`, in load order
