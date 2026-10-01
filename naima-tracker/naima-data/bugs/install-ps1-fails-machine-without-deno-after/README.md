# install.ps1 fails on a machine without Deno: after Deno's installer runs it looks only on the session path, not in ~/.deno/bin

## Where

`site/install.ps1`, the Deno lookup.

## What is wrong (the failure)

On a Windows machine without Deno, `install.ps1` runs Deno's official installer, which puts `deno.exe` in `~\.deno\bin` and adds that folder to the user's PATH — not to the running session's. The script then looked for Deno with `Get-Command deno` only, found nothing, and stopped with "Deno was installed but is not on the path: open a new terminal and run this again". A first-time Windows user's first run therefore always failed; the second run (new window) worked.

## Evidence

Measured on a real Windows 11 machine (Windows PowerShell 5.1, git 2.53), 2026-10-01: the first `install.ps1` run in a fresh `git init` folder installed Deno 2.9.7 and then refused with the message above (attachment windows-deno-install-first-run-2026-10-01.log). `install.sh` already looks in `~/.deno/bin` after installing; only the Windows script did not.

## The fix

One lookup, `Find-Deno` (the session path, then `$DENO_INSTALL\bin` or `~\.deno\bin`), run both before and after Deno's installer.

## Done

Regression test in `test/site.test.ts` (reads the script, since no test runs PowerShell); a real Windows run of the fixed script with Deno removed from the session path finds it in `~\.deno\bin` and installs Naima.
