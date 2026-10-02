#!/bin/sh
# The repository split (epic "Product repo is the install; development in
# naima-dev"): from one commit of this repository, two commits, both its
# children, made in a scratch directory and pushed nowhere.
#
#   P, branch split/product — the product: the tree of <commit>:naima at the
#     root, nothing else. Pushed to vincenzoml/naima main as a fast-forward.
#   W, branch split/workshop — the workshop: <commit> without naima/, which
#     becomes a submodule at P (url: the product), the workshop changes of
#     scripts/split/workshop.patch applied, and Naima's own tracker moved to
#     P by P's own `naima update` (the lock names P, the data migrated).
#     Pushed to vincenzoml/naima-dev main, after P is on the product.
#
# Dry run by default: it prints each step. --execute runs them, in <out>:
#   <out>/work        a clone of the source, holding both branches
#   <out>/product.git a bare repository, main = P: the product as it will be
#   <out>/workshop    a checkout of W, its submodule at P and its stable clone
#                     naima-tracker/naima/ at P: verify runs there
# Rerun, it rebuilds <out> from scratch; the dates of P and W are those of
# <commit>, so the same commit gives the same P and W.
#
#   sh scripts/split.sh [--execute] [--source <repo>] [--commit <rev>]
#                       [--product <url>] [--out <dir>]
#
# Needs git and deno. Never pushes to a remote it did not create.

set -eu

SOURCE=$(cd "$(dirname "$0")/.." && pwd)
COMMIT=main
PRODUCT=https://github.com/vincenzoml/naima.git
OUT=${TMPDIR:-/tmp}/naima-split
EXECUTE=0

while [ $# -gt 0 ]; do
  case $1 in
    --execute) EXECUTE=1 ;;
    --source) SOURCE=$2; shift ;;
    --commit) COMMIT=$2; shift ;;
    --product) PRODUCT=$2; shift ;;
    --out) OUT=$2; shift ;;
    *) echo "usage: sh scripts/split.sh [--execute] [--source <repo>] [--commit <rev>] [--product <url>] [--out <dir>]" >&2; exit 2 ;;
  esac
  shift
done

die() { echo "split: $*" >&2; exit 1; }
step() { echo "== $*"; }
# A command: printed, and run only with --execute.
run() {
  echo "  \$ $*"
  [ "$EXECUTE" = 1 ] || return 0
  "$@"
}

command -v git >/dev/null || die "git is needed"
command -v deno >/dev/null || die "deno is needed"
SHA=$(git -C "$SOURCE" rev-parse --verify --quiet "$COMMIT^{commit}") || die "$COMMIT is not a commit of $SOURCE"
git -C "$SOURCE" cat-file -e "$SHA:naima/src/cli.ts" 2>/dev/null || die "$COMMIT holds no naima/src/cli.ts: it is not of the workshop layout"
git -C "$SOURCE" cat-file -e "$SHA:scripts/split/workshop.patch" 2>/dev/null || die "$COMMIT holds no scripts/split/workshop.patch"
case $OUT in /*) ;; *) OUT=$(pwd)/$OUT ;; esac

WORK=$OUT/work
BARE=$OUT/product.git
SHOP=$OUT/workshop
DATE=$(git -C "$SOURCE" log -1 --format=%cI "$SHA")
export GIT_AUTHOR_DATE="$DATE" GIT_COMMITTER_DATE="$DATE"

echo "split: $SOURCE at ${SHA%"${SHA#????????????}"}, product $PRODUCT, into $OUT$([ "$EXECUTE" = 1 ] || echo ' (dry run: --execute to run it)')"

step "a fresh clone of the source"
run rm -rf "$OUT"
run mkdir -p "$OUT"
run git clone --quiet --no-local --no-checkout -- "$SOURCE" "$WORK"

step "P: the tree of naima/ at the root, child of $COMMIT"
PTREE=$(git -C "$SOURCE" rev-parse "$SHA:naima")
echo "  \$ git commit-tree $PTREE -p $SHA  (the tree of $COMMIT:naima)"
P=0000000000000000000000000000000000000000
if [ "$EXECUTE" = 1 ]; then
  P=$(git -C "$WORK" commit-tree "$PTREE" -p "$SHA" -m "The product at the root: naima/ moves up, the workshop leaves

Naima's development (tests, scripts, site, develop/, the agent rules and
Naima's own tracker) moves to github.com/vincenzoml/naima-dev, which holds
this repository's full history and this product as its submodule naima/.
Every earlier commit is unchanged, so every lock of a past commit still
aligns.")
  git -C "$WORK" branch -f split/product "$P"
  [ "$(git -C "$WORK" rev-parse "$P^{tree}")" = "$PTREE" ] || die "P's tree is not $COMMIT:naima"
  for f in test develop scripts site naima-tracker AGENTS.md CLAUDE.md deno.json .github; do
    git -C "$WORK" cat-file -e "$P:$f" 2>/dev/null && die "P holds $f"
  done
  echo "  P = $P"
fi
run git init --quiet --bare "$BARE"
run git -C "$WORK" push --quiet "$BARE" "split/product:refs/heads/main"

step "W: $COMMIT without naima/, naima/ a submodule at P, the workshop patch"
run git -C "$WORK" checkout --quiet -B split/workshop "$SHA"
run git -C "$WORK" rm -r -q --cached -- naima
run rm -rf "$WORK/naima"
run git -C "$WORK" config -f .gitmodules submodule.naima.path naima
run git -C "$WORK" config -f .gitmodules submodule.naima.url "$PRODUCT"
run git -C "$WORK" add .gitmodules
run git -C "$WORK" update-index --add --cacheinfo "160000,$P,naima"
run git -C "$WORK" apply --3way --index scripts/split/workshop.patch
# The script and its patch have done their work: the workshop keeps them in its history.
run git -C "$WORK" rm -r -q -- scripts/split.sh scripts/split
# The product, as it will be on GitHub, is read from the bare repository until it is pushed.
INSTEAD="url.$BARE.insteadOf=$PRODUCT"
run git -C "$WORK" -c protocol.file.allow=always -c "$INSTEAD" submodule --quiet update --init naima
run git -C "$WORK" -c protocol.file.allow=always -c "$INSTEAD" clone --quiet -c core.autocrlf=false -- "$PRODUCT" naima-tracker/naima

step "W: Naima's own tracker moved to P by P's own naima update"
run git -C "$WORK" config "url.$BARE.insteadOf" "$PRODUCT"
run git -C "$WORK/naima-tracker/naima" config "url.$BARE.insteadOf" "$PRODUCT"
if [ "$EXECUTE" = 1 ]; then
  (cd "$WORK" && deno run -A naima-tracker/naima/naima.ts update) || die "naima update failed"
  (cd "$WORK" && deno run -A naima-tracker/naima/naima.ts update) >/dev/null || die "naima update failed on its second run"
  grep -q "\"commit\": \"$P\"" "$WORK/naima-tracker/naima-data/naima.json" || die "the lock does not name P"
  grep -q "\"source\": \"$PRODUCT\"" "$WORK/naima-tracker/naima-data/naima.json" || die "the lock's source is not $PRODUCT"
else
  echo "  \$ deno run -A naima-tracker/naima/naima.ts update  (twice: lock to P, then the data migrated)"
fi
run git -C "$WORK" config --unset "url.$BARE.insteadOf"
run git -C "$WORK/naima-tracker/naima" config --unset "url.$BARE.insteadOf"
run git -C "$WORK" add -A -- naima-tracker/naima-data
run git -C "$WORK" commit --quiet -m "The workshop: naima/ is the product, as a submodule; Naima's tracker runs its stable clone

naima/ is github.com/vincenzoml/naima at the commit the submodule records;
naima-tracker/naima/ is a gitignored clone of it at the locked commit, moved
by naima update. The site deploys to the product's gh-pages branch."
if [ "$EXECUTE" = 1 ]; then
  W=$(git -C "$WORK" rev-parse HEAD)
  [ "$(git -C "$WORK" rev-parse HEAD:naima)" = "$P" ] || die "W's submodule is not at P"
  echo "  W = $W"
fi

step "a checkout of W, where verify runs"
run git clone --quiet --no-local --branch split/workshop -- "$WORK" "$SHOP"
run git -C "$SHOP" -c protocol.file.allow=always -c "$INSTEAD" submodule --quiet update --init naima
run git -C "$SHOP" -c protocol.file.allow=always -c "$INSTEAD" clone --quiet -c core.autocrlf=false -- "$PRODUCT" naima-tracker/naima
run git -C "$SHOP/naima-tracker/naima" -c advice.detachedHead=false checkout --quiet "$P"

step "done"
echo "  product:  $WORK split/product (P), also $BARE main"
echo "  workshop: $WORK split/workshop (W), checked out in $SHOP"
echo "  next: in $SHOP, deno task verify; the outward steps push P, then W"
