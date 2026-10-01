# install.ps1 installs Naima on a Windows machine: fresh, again, refusing outside a repository, and the piped form

On a Windows machine with git and Deno, in a fresh `git init` folder: `irm https://vincenzoml.github.io/naima/install.ps1 | iex` (or `powershell -File install.ps1`). Pass: `all invariants hold`; naima-tracker\naima\ holds naima/'s files and `.naima-copy.json`, no `.git`, no tests, no AGENTS.md; run again says `already installed`; outside a repository it refuses with `not a git repository. Is this the root of your project? ...`; the piped form installs too.

## Result

2026-10-01, agent, over ssh on a real Windows 11 machine (build 26200, Windows PowerShell 5.1, git 2.53; no PowerShell 7), each case in its own scratch folder under %TEMP%, the script downloaded from the published site (identical to main's site/install.ps1):

- Fresh, `powershell -File install.ps1`: cloned main, `naima init` locked to 45f997936a39 (which contains the Windows toplevel fix b4230e5), `all invariants hold`, exit 0. naima-tracker\naima\naima.ts and `.naima-copy.json` present; no `.git`, no AGENTS.md, no `test` folder, 0 `*.test.ts` files.
- Run again: "Naima is already installed here … checking it", `all invariants hold`, exit 0.
- Outside a repository: refused with "this is not a git repository. Is this the root of your project? If so, ask your agent to create a repository here …", exit 1, no naima-tracker created.
- Piped, `irm https://vincenzoml.github.io/naima/install.ps1 | iex`: installed (locked to 100eba52c7ae, main having moved), `all invariants hold`, exit 0; the installed `naima list` runs (0 items).

Log: windows-install-proof-2026-10-01.log. Deno was missing on the machine at the start: the first attempt installed it with Deno's official installer and then failed — filed and fixed as bugs/install-ps1-fails-machine-without-deno-after (proven by tests/install-ps1-finds-deno-deno-bin-when). The passing run above found Deno already installed.
