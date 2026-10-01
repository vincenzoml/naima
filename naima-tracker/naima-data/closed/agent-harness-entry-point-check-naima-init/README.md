# Agent-harness entry-point check, and `naima init` writes the agent pointer (opt-in)

Each agent tool reads its own always-on file, which mostly exists to point at the rulebook; if the pointer is wrong nothing errors, the agent is simply taught nothing. `naima init` is requested to offer writing this pointer, opt-in, like `--write-excludes`.

Done: project config lists the harness entry files (sensible defaults for common tools); `naima check` reports a plain-text path or link in them that names a missing file; `naima init --write-agent-pointer` (opt-in, default off) writes the one-line pointer to AGENTS.md/CLAUDE.md and the other configured entry files instead of only printing it.
