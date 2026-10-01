#!/bin/sh
# Install Naima in the git repository you are standing in (macOS, Linux).
#
#   curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh
#
# It clones Naima's main, shallow, into a temporary folder, and runs its
# `naima init`: that records the commit in naima-tracker/naima-data/naima.json
# and copies Naima's naima/ folder, only, into naima-tracker/naima/ through
# the per-user cache. Then it runs `naima check`, and removes the temporary
# clone. Nothing is installed globally for Naima; Deno, the
# one thing Naima needs on the machine, is installed with its official
# installer when it is missing. Run again, it says Naima is installed and
# checks it. What it does by hand: naima/docs/guide/install.md#bootstrap-a-project.
#
#   NAIMA_SOURCE           the repository to clone (default: Naima's on GitHub)
#   NAIMA_REF              the branch to install (default: main)
#   NAIMA_NO_DENO_INSTALL  when set, never install Deno: say how, and stop

set -eu

SOURCE=${NAIMA_SOURCE:-https://github.com/vincenzoml/naima.git}
REF=${NAIMA_REF:-main}
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
    Darwin) die "git is missing: install it with 'xcode-select --install' (or 'brew install git' with Homebrew), then run this again" ;;
    *) die "git is missing: install it with your package manager (sudo apt install git, sudo dnf install git, sudo pacman -S git, ...), then run this again" ;;
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

# A shallow clone of the source, outside the project, removed on exit: the Naima that installs.
fetch_naima() {
  CLONE=$(mktemp -d "${TMPDIR:-/tmp}/naima-install.XXXXXX") || die "cannot make a temporary folder"
  trap 'rm -rf "$CLONE"' EXIT
  say "fetching $SOURCE ($REF)"
  git clone --quiet --depth 1 --branch "$REF" -- "$SOURCE" "$CLONE/naima" 2>/dev/null ||
    git clone --quiet --branch "$REF" -- "$SOURCE" "$CLONE/naima" ||
    die "cannot clone $SOURCE ($REF): check the network, or NAIMA_SOURCE and NAIMA_REF"
}
installer() { "$DENO" run -A "$CLONE/naima/naima/naima.ts" "$@"; }

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
    die "this is not a git repository. Is this the root of your project? If so, ask your agent to create a repository here and install Naima from https://vincenzoml.github.io/naima/"
  if [ "$(cd "$ROOT" && pwd -P)" != "$(pwd -P)" ]; then say "installing at the top of this repository: $ROOT"; fi
  cd "$ROOT"
  need_deno

  if [ -e "$PROGRAM" ] && [ ! -f "$PROGRAM/naima.ts" ]; then
    die "$PROGRAM exists and is not Naima: move it away, then run this again"
  fi

  if [ -f "$LOCK" ]; then
    say "Naima is already installed here ($LOCK): checking it"
    if [ -f "$PROGRAM/naima.ts" ]; then
      naima check
    else
      fetch_naima
      say "copying the locked commit into $PROGRAM"
      installer check
    fi
    say "up to date? naima update --check; to update: naima update (docs: $PROGRAM/docs/guide/install.md#updating)"
    return 0
  fi

  fetch_naima
  installer init
  naima check
  next_steps
}

main "$@"
