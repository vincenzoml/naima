# The pre-commit hook passes an unrelated commit without starting Naima, fails a tracker change, and is skipped by --no-verify (test/plugins/hooks/hooks.test.ts, on Deno, Node and Bun)

Run the same three commands. With core.hooksPath set by `naima hooks install` and a stub in place of Naima, a commit of an unrelated file must pass without starting it, a commit touching the tracker must fail, and `--no-verify` must skip the hook; install must refuse a foreign core.hooksPath unless --force, uninstall must undo only its own, and a hook no longer matching the rules must fail the hook-current check.

Result 2026-10-01: red first — with the path scope removed, the unrelated commit started the stub and failed; restored, the hook tests passed on Deno, Node and Bun; full suites 303 of 303 each.
