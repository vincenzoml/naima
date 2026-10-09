# Tools: what a plugin needs, installed by Naima

A model checker such as mCRL2 or Storm is a program of its own. The plugin
that uses it says which one, at which exact version, and where each platform
gets it from; Naima installs it on the machine it runs on, into a directory of
its own, when you say yes. An agent does this for you; each command below is
what it types, so you can check what it did.

## What this machine has

```sh
naima tools
```

```text
tools on this machine (darwin-arm64), in /Users/you/Library/Application Support/naima/tools:
  mcrl2    202607.0         installed  [verifier-mcrl2]
  python   3.13.16+20261003 missing — naima tools install python  [storm]
  storm    1.14.0           missing — naima tools install storm  [storm]
```

Every tool the project's plugins declare, with one state: `installed`,
`missing` (with the command that installs it), `unavailable here` (with the
reason, and what to do instead), or `no declaration for` this platform. It
writes nothing. `naima tools --json` prints the same as data.

`naima tools show storm` prints what an install would fetch — for the tool and
every tool it needs: the source, the size, the sha256 and the licence.

## Install one

```sh
naima tools install mcrl2
```

Naima prints the plan — source, size, licence — and asks `Install? [y/N]`.
Only `y` goes on. An agent has no terminal to ask on: it shows you the plan,
asks you, and passes your answer with `--consent "<your yes, restated>" --by
<you>`. The yes, who gave it, how and when are kept in the install's receipt.

Then Naima downloads the file, checks that its size and sha256 are the
declared ones, unpacks it, and runs the tool once to see that it works on this
machine (for mCRL2, `mcrl22lps --version` must say `202607.0`). If any step
fails, nothing is kept. The verifier that declared the tool uses it from then
on, without anything on your `PATH`.

## Where the tools go

| System | Directory |
|---|---|
| macOS | `~/Library/Application Support/naima/tools` |
| Linux | `$XDG_DATA_HOME/naima/tools`, by default `~/.local/share/naima/tools` |
| Windows | `%LOCALAPPDATA%\naima\tools` |

`NAIMA_TOOLS`, set to an absolute path, names another. One directory per user
and machine serves every project and every worktree. Nothing is written
anywhere else: no `PATH`, no shell file, no system folder, no administrator
rights. Deleting the directory removes every tool and leaves the machine as it
was.

## Remove one

```sh
naima tools remove storm
```

It removes every version of the tool from the directory. A tool another
installed tool needs — the Python under Storm — is refused until that one is
removed.

## The first tools

| Tool | Version | Plugin | macOS arm64 | macOS x86_64 | Linux x86_64 | Linux arm64 | Windows x86_64 |
|---|---|---|---|---|---|---|---|
| `mcrl2` | 202607.0 | `verifier-mcrl2` | yes | yes | yes, glibc 2.38 or later | no build published | yes |
| `storm` | stormpy 1.14.0 | `storm` | yes, macOS 14 or later | yes, macOS 15 or later | yes, glibc 2.34 or later | yes, glibc 2.34 or later | no build published |
| `python` | 3.13.16 | `storm` | yes | yes | yes | yes | yes |

- mCRL2 on Linux comes from its `.deb` package, unpacked into the tools
  directory, never installed into the system.
- Storm is its Python package, in a Python environment of its own, on a Python
  Naima installs too: the system's Python is never used. `naima tools path
  storm python` prints that Python, which imports `stormpy`, for your scripts.
  The `storm` plugin is off until the project turns it on: `naima plugin
  enable storm`.
- Where a platform has no build, `naima tools` says so and what to do: run that
  work on another machine (below).

## On another machine

```sh
naima tools --host lab
naima tools install mcrl2 --host lab
```

`--host` asks a machine declared for [long work](long-work.md#on-another-machine)
through its own Naima, over ssh. An install there shows that machine's plan
and asks your yes here; the tool goes into that machine's tools directory.

## For plugin authors

A plugin declares a tool under `contributes.tools`: `name`, `title`, `says`,
`version` (one exact version), `licence`, `homepage`, `needs`, `programs`,
`verify` (a program, its arguments, and what its output must contain), and
`platforms`, one entry per `darwin-arm64`, `darwin-x64`, `linux-x64`,
`linux-arm64`, `windows-x64`: either a source — `url`, `size`, `sha256`,
`format` (`zip`, `tar.gz`, `dmg`, `deb` or `pip`), `bin` — or
`{ "unavailable": "<why, and what to do>" }`. A declaration missing any of
these stops the project from loading, naming the plugin. The plugin finds an
installed program with `installedProgram(tool, program)` from the plugin API.
The [reference](../reference/reference.md) lists every declared tool.
