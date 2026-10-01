# Install Naima in the git repository you are standing in (Windows PowerShell).
#
#   irm https://vincenzoml.github.io/naima/install.ps1 | iex
#
# It clones Naima's dist branch into naima-tracker\naima\, runs `naima init`,
# and runs `naima check`. Nothing is installed globally for Naima; Deno, the
# one thing Naima needs on the machine, is installed with its official
# installer when it is missing. Run again, it says Naima is installed and
# checks it. What it does by hand: docs/guide/install.md#bootstrap-a-project.
#
#   NAIMA_SOURCE           the repository to clone (default: Naima's on GitHub)
#   NAIMA_REF              the branch to clone (default: dist)
#   NAIMA_NO_DENO_INSTALL  when set, never install Deno: say how, and stop
#
# Run with `irm | iex` it runs in your session, so it never calls `exit`: a
# refusal is an error, and your window stays open.

function Install-Naima {
  $ErrorActionPreference = 'Stop'
  $Source = if ($env:NAIMA_SOURCE) { $env:NAIMA_SOURCE } else { 'https://github.com/vincenzoml/naima.git' }
  $Ref = if ($env:NAIMA_REF) { $env:NAIMA_REF } else { 'dist' }
  $Program = 'naima-tracker/naima'
  $Lock = 'naima-tracker/naima-data/naima.json'

  function Say($m) { Write-Host "naima: $m" }
  function Invoke-Checked($exe, [string[]]$argv) {
    & $exe @argv
    if ($LASTEXITCODE -ne 0) { throw "naima: '$exe $($argv -join ' ')' failed (exit $LASTEXITCODE)" }
  }

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'naima: git is missing: install it (winget install --id Git.Git -e), open a new terminal, and run this again'
  }
  # Windows PowerShell 5.1 turns a native command's redirected stderr into an error under 'Stop'.
  $ErrorActionPreference = 'Continue'
  $Root = & git rev-parse --show-toplevel 2>$null
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0 -or -not $Root) {
    throw 'naima: this is not a git repository. Run the installer from the root of the repository Naima should track (git init makes one).'
  }
  $Root = (Resolve-Path $Root).Path
  if ($Root -ne (Get-Location).Path) { Say "installing at the top of this repository: $Root" }

  $Deno = Get-Command deno -ErrorAction SilentlyContinue
  if (-not $Deno) {
    $Home_ = if ($env:DENO_INSTALL) { $env:DENO_INSTALL } else { Join-Path $HOME '.deno' }
    $Candidate = Join-Path (Join-Path $Home_ 'bin') 'deno.exe'
    if (Test-Path $Candidate) { $Deno = Get-Item $Candidate }
  }
  if (-not $Deno) {
    if ($env:NAIMA_NO_DENO_INSTALL) {
      throw "naima: Deno is missing. Install it once with its official installer, then run this again:`n    irm https://deno.land/install.ps1 | iex"
    }
    Say 'Deno is missing: installing it with its official installer (https://deno.land/install.ps1)'
    Invoke-RestMethod https://deno.land/install.ps1 | Invoke-Expression
    $Deno = Get-Command deno -ErrorAction SilentlyContinue
    if (-not $Deno) { throw 'naima: Deno was installed but is not on the path: open a new terminal and run this again' }
  }
  $DenoExe = if ($Deno.Source) { $Deno.Source } else { $Deno.FullName }

  Push-Location $Root
  try {
    if ((Test-Path $Program) -and -not (Test-Path (Join-Path $Program '.git'))) {
      throw "naima: $Program exists and is not a clone of Naima: move it away, then run this again"
    }
    if (Test-Path $Lock) {
      Say "Naima is already installed here ($Lock): checking it"
      if (-not (Test-Path $Program)) {
        Say "cloning $Source ($Ref) into $Program; the run aligns it to the locked commit"
        Invoke-Checked git @('clone', '--quiet', '--branch', $Ref, '--', $Source, $Program)
      }
      Invoke-Checked $DenoExe @('run', '-A', "$Program/naima.ts", 'check')
      Say "up to date? naima update --check; to update: naima update (docs: $Program/docs/install.md#updating)"
      return
    }
    if (-not (Test-Path $Program)) {
      Say "cloning $Source ($Ref) into $Program"
      Invoke-Checked git @('clone', '--quiet', '--branch', $Ref, '--', $Source, $Program)
    }
    Invoke-Checked $DenoExe @('run', '-A', "$Program/naima.ts", 'init')
    Invoke-Checked $DenoExe @('run', '-A', "$Program/naima.ts", 'check')
    Write-Host @"

Naima is installed in $Root.

Next:
  git add naima-tracker; git commit -m "Track this project with Naima"
  function naima { deno run -A "`$(git rev-parse --show-toplevel)/naima-tracker/naima/naima.ts" @args }

Agents: read $Program/skills/naima/SKILL.md
"@
  } finally {
    Pop-Location
  }
}

Install-Naima
