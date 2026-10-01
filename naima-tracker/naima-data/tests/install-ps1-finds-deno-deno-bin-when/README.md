# install.ps1 finds Deno in ~\.deno\bin when it is not on the session path (real Windows run, and test/site.test.ts)

## Gesture

1. `deno test -A test/site.test.ts --filter "install.ps1 looks"`: the script runs one lookup, `Find-Deno` (session path, then `~\.deno\bin`), before and after Deno's installer.
2. On a real Windows 11 machine (Windows PowerShell 5.1, git 2.53, Deno 2.9.7 in `~\.deno\bin`), in a fresh `git init` folder, with every `.deno` folder removed from the session's `$env:Path`: `powershell -File install.ps1` (the fixed script).

## Result

2026-10-01, agent: (1) red on main before the fix (no `Find-Deno`), green after (7 passed, 0 failed in test/site.test.ts). (2) "deno on session path: False", then the fixed script found `deno.exe` in `~\.deno\bin`, installed Naima (locked to 100eba52c7ae), `all invariants hold`, exit 0 (windows-install-fixed-deno-off-path-2026-10-01.log). Not re-run: Deno's installer itself on a machine without Deno — the first run (windows-deno-install-first-run-2026-10-01.log, on the bug) shows that installer puts `deno.exe` exactly where `Find-Deno` now looks.
