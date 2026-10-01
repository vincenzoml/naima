# Companion records required in the same commit

A record written 'later' is never written: a shipped feature with no catalogue row, a fix with no proving test, a close with no hash, an asset with no provenance.

Done: a project rule can say 'a change under path P (or of kind K) must come with a change to an item of type T in the same commit'; `naima check --staged` evaluates it, and a pre-commit hook runs it; the commit flow lists the companions; one built-in rule: setting `fixedOn` requires a linked verifying test.
