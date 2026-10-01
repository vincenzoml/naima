# Shared-stash hazard: document safe stash practice

Every worktree shares one stash stack; a bare `pop` lands another session's work in your checkout, and a stash taken to measure a baseline can swap files under a running process.

Done: worktree-isolation.md says to prefer a temporary WIP commit; if a stash is unavoidable, push with a unique message, apply by sha, never `pop`, and drop by finding the tag again; never stash to measure a baseline while a resource is running — read the recorded baseline instead.
