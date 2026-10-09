# Tools

When a verifier reports `tool missing:`, or work needs a model checker on a
machine, the tool is installed by Naima, never by hand: no Homebrew, no apt,
no download into the system, nothing added to `PATH`.

1. `naima tools` (with `--host <h>` for another machine): what is installed,
   missing or unavailable there. An unavailable tool says why and what to do;
   say that to the owner, do not work around it.
2. `naima tools show <tool>`: the plan — every tool it installs, with source,
   size and licence.
3. Show the owner that plan and ask. Install only on their yes:
   `naima tools install <tool> --consent "<their yes, restated in your words>"
   --by <who>`. The consent is recorded in the receipt on that machine; an
   install without it is refused. A yes given once covers that plan on that
   machine, not later installs.
4. The install verifies the tool by running it; a failure leaves nothing
   installed and says why (a Linux too old for the build, say) — report it.

`naima tools path <tool> [<program>]` prints an installed program for a script
(`naima tools path storm python`). `naima tools remove <tool>` removes one.
For people: [tools](../guide/tools.md).
