# Companion records required in the same commit

A record written 'later' is never written: a shipped feature with no catalogue row, a fix with no proving test, a close with no hash, an asset with no provenance.

Done: a project rule can say 'a change under path P (or of kind K) must come with a change to an item of type T in the same commit'; `naima check --staged` evaluates it, and a pre-commit hook runs it; the commit flow lists the companions; one built-in rule: setting `fixedOn` requires a linked verifying test.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u14-commit-hook

The plugin is named commit-hooks: `hooks` is the core's name for write hooks, which the core may not share with a plugin. Rules go under plugins.commit-hooks.options.companions in naima.json; the guide is naima/docs/guide/commit-hooks.md.

### 2026-10-01 — Vincenzo Ciancia, on claude/u14-commit-hook

Landed in commit fff5255063e643409976291b7d85d3294a5b177b on claude/u14-commit-hook (the commits field is not declared for features by the locked program; set it once the lock moves).
