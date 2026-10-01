# Specs are versioned name-vN, a revision supersedes, one current version per name

The gesture: run `deno test -A test/plugins/planning/planning.test.ts`, test "a spec is versioned name-vN". It opens a spec (asserting name and version 1 stamped from the title), revises it with `naima spec revise` (asserting v2 is a draft, titled `… v2`, with the same page and a `supersedes` link), and asserts: two current versions are a problem; a version superseded by a current one but not marked superseded is a problem; an open feature following the superseded version is noted; `naima spec --json` names the current version; revising a non-spec is refused.

## Result

2026-10-01, agent on claude/u6-planning (commit fca156d). Red first against a stub plugin: 0 passed, 3 failed. Green: 3 passed, 0 failed; whole suite 223 passed on Deno, Node and Bun. By hand in a scratch project: `naima spec revise specs/export-format` printed `export-format-v2 (draft) supersedes export-format-v1`.
