#!/bin/sh
# Install Naima in the git repository you are standing in (macOS, Linux).
#
#   curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh
#
# It clones Naima's dist branch into naima-tracker/naima/, runs `naima init`,
# and runs `naima check`. Nothing is installed globally for Naima; Deno, the
# one thing Naima needs on the machine, is installed with its official
# installer when it is missing. Run again, it says Naima is installed and
# checks it. What it does by hand: naima/docs/guide/install.md#bootstrap-a-project.
#
#   NAIMA_SOURCE           the repository to clone (default: Naima's on GitHub)
#   NAIMA_REF              the branch to clone (default: dist)
#   NAIMA_NO_DENO_INSTALL  when set, never install Deno: say how, and stop

set -eu

SOURCE=${NAIMA_SOURCE:-https://github.com/vincenzoml/naima.git}
REF=${NAIMA_REF:-dist}
PROGRAM=naima-tracker/naima
LOCK=naima-tracker/naima-data/naima.json

say() { printf 'naima: %s\n' "$*"; }
die() {
  printf 'naima: %s\n' "$*" >&2
  exit 1
}

need_git() {
  command -v git >/dev/null 2>&1 && return 0
  case "$(uname -s)" in
    Darwin) die "git is missing: install it with 'xcode-select --install', then run this again" ;;
    *) die "git is missing: install it with your package manager (apt install git, dnf install git, ...), then run this again" ;;
  esac
}

find_deno() {
  if command -v deno >/dev/null 2>&1; then
    DENO=$(command -v deno)
    return 0
  fi
  for d in "${DENO_INSTALL:-}/bin/deno" "$HOME/.deno/bin/deno"; do
    if [ -x "$d" ]; then
      DENO=$d
      return 0
    fi
  done
  return 1
}

need_deno() {
  find_deno && return 0
  if [ -n "${NAIMA_NO_DENO_INSTALL:-}" ]; then
    die "Deno is missing. Install it once with its official installer, then run this again:
    curl -fsSL https://deno.land/install.sh | sh"
  fi
  say "Deno is missing: installing it with its official installer (https://deno.land/install.sh)"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://deno.land/install.sh | sh -s -- -y
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://deno.land/install.sh | sh -s -- -y
  else
    die "neither curl nor wget is here to fetch Deno's installer: install Deno (https://docs.deno.com/runtime/getting_started/installation/), then run this again"
  fi
  find_deno || die "Deno was installed but is not where its installer puts it (~/.deno/bin): open a new shell and run this again"
}

naima() { "$DENO" run -A "$PROGRAM/naima.ts" "$@"; }

next_steps() {
  cat <<EOF

Naima is installed in $ROOT.

Next:
  git add naima-tracker && git commit -m "Track this project with Naima"
  alias naima='deno run -A "\$(git rev-parse --show-toplevel)/naima-tracker/naima/naima.ts"'

Agents: read $PROGRAM/skills/naima/SKILL.md
EOF
}

main() {
  need_git
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null) ||
    die "this is not a git repository. Run the installer from the root of the repository Naima should track (git init makes one)."
  if [ "$(cd "$ROOT" && pwd -P)" != "$(pwd -P)" ]; then say "installing at the top of this repository: $ROOT"; fi
  cd "$ROOT"
  need_deno

  if [ -e "$PROGRAM" ] && ! git -C "$PROGRAM" rev-parse --git-dir >/dev/null 2>&1; then
    die "$PROGRAM exists and is not a clone of Naima: move it away, then run this again"
  fi

  if [ -f "$LOCK" ]; then
    say "Naima is already installed here ($LOCK): checking it"
    if [ ! -e "$PROGRAM" ]; then
      say "cloning $SOURCE ($REF) into $PROGRAM; the run aligns it to the locked commit"
      git clone --quiet --branch "$REF" -- "$SOURCE" "$PROGRAM"
    fi
    naima check
    say "up to date? naima update --check; to update: naima update (docs: $PROGRAM/docs/guide/install.md#updating)"
    return 0
  fi

  if [ ! -e "$PROGRAM" ]; then
    say "cloning $SOURCE ($REF) into $PROGRAM"
    git clone --quiet --branch "$REF" -- "$SOURCE" "$PROGRAM"
  fi
  naima init
  naima check
  next_steps
}

main "$@"
