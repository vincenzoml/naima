# nativePath turns git's forward-slash toplevel into a Windows path (test/git.test.ts, on Deno, Node and Bun)

## Gesture

`deno test -A test/git.test.ts`, then the same file under Node (`node --test test/git.test.ts`) and Bun (`bun test test/git.test.ts`). The test "nativePath turns git's forward-slash toplevel into the separator a Windows node:fs path uses" feeds git's `D:/…` form of a toplevel and a Windows separator to `nativePath()` (`naima/src/core/git.ts`) and expects `real()`'s backslash form, which `runningCommit()` (`naima/src/core/cli.ts`) compares it with.

Pass: green on all three runtimes. A real Windows install is proven separately by the owner's gesture tests/install-ps1-installs-naima-windows-machine-fresh.

## Result

2026-10-01, final sweep (claude/final-sweep). Red: with `nativePath()` reduced to the identity (the comparison as it was before the fix), the test fails on Deno. Green: restored, it passes on Deno, Node and Bun (the full gates of the sweep).
