# Outward: create naima-dev and push it, push the product commit, move Pages to gh-pages, migrate the trackers

Part of the epic "Product repo is the install; development in naima-dev"
(section "Order of operations", steps 3–7). Outward-facing: the coordinator
and the owner do it, never a worker. Every step changes GitHub.

## Definition of done

- [ ] 3. Tag `pre-split` on `main`, push it. Owner creates the empty
  `vincenzoml/naima-dev`; push `main` as it is, with every tag.
- [ ] 4. Run `scripts/split.sh` with the real remotes; push P to
  `vincenzoml/naima` `main` (an ordinary fast-forward push).
- [ ] 5. Push W to `naima-dev` `main`; set `origin` of every local workshop
  clone to `https://github.com/vincenzoml/naima-dev.git`.
- [ ] 6. Owner: write deploy key on the product, secret `PRODUCT_DEPLOY_KEY` on
  `naima-dev`; after the first `gh-pages` push, the product's Pages source set
  to the branch `gh-pages`.
- [ ] 7. Migrate Naima's own tracker in `naima-dev` (installer rerun, one
  commit), then the paper repository and any other host.
- [ ] The paper's repository URL and artifact names (the open todo about the
  public repository URL named in the paper) say which repository holds what.

## Files

None in this repository besides `naima-tracker/naima-data/naima.json` (step 7).

Sequential: last, after unit 6.

## Proving gesture

`git clone https://github.com/vincenzoml/naima` holds exactly the product
files at its head; `curl -fsS https://vincenzoml.github.io/naima/install.sh | sh`
installs into a fresh repository and `naima check` passes; in `naima-dev`,
`deno task naima check` runs the stable clone; a v1.0.0 host that has not
migrated still aligns.

## Notes

### 2026-10-02 — Vincenzo Ciancia, on claude/split-restructure

The outward commands, in order (the move script, scripts/split.sh, rehearsed locally: see the move-script item). Run from the main checkout `/Users/vincenzo/data/local/repos/naima` once the move-script branch and the other split units are merged on `main`, `deno task verify` is green and `main` is pushed. `OUT=$TMPDIR/naima-split`.

1. Tag and keep the old layout: `git tag pre-split main && git push origin pre-split`.
2. Owner: create the empty `vincenzoml/naima-dev` (`gh repo create vincenzoml/naima-dev --public`), then push today's history with every tag: `git push https://github.com/vincenzoml/naima-dev.git main --tags`.
3. Make P (product) and W (workshop): `sh scripts/split.sh --execute --commit main --out "$OUT"` (prints P and W; dry run without `--execute`). Gate, in `$OUT/workshop`: `perl -e 'alarm 1200; exec @ARGV' deno task verify`, `node --test "test/**/*.test.ts"`, `bun test --timeout 30000 ./test/`.
4. Push P to the product as a fast-forward (no force): `git -C "$OUT/work" fetch https://github.com/vincenzoml/naima.git main && git -C "$OUT/work" merge-base --is-ancestor FETCH_HEAD split/product && git -C "$OUT/work" push https://github.com/vincenzoml/naima.git split/product:main`. From here the live installer works: it clones the product, which now holds only the program.
5. Push W to the workshop, after P: `git -C "$OUT/work" push https://github.com/vincenzoml/naima-dev.git split/workshop:main`.
6. Move the local checkout to the workshop: `git remote set-url origin https://github.com/vincenzoml/naima-dev.git && git fetch origin`; move aside untracked files under `naima/` (today `naima/.vscode/`), then `git merge --ff-only origin/main && git submodule update --init`; replace the legacy stable copy: `mv naima-tracker/naima naima-tracker/.naima-legacy-$(date +%F) && git clone https://github.com/vincenzoml/naima.git naima-tracker/naima && deno task naima check` (aligns to the lock, P). Each other worktree: `git submodule update --init --reference /Users/vincenzo/data/local/repos/naima/naima` and the same stable-clone step.
7. Pages (owner, credentials): `ssh-keygen -t ed25519 -N '' -C naima-dev-pages -f "$OUT/pages-key"`; `gh repo deploy-key add "$OUT/pages-key.pub" --repo vincenzoml/naima --allow-write --title naima-dev-pages`; `gh secret set PRODUCT_DEPLOY_KEY --repo vincenzoml/naima-dev < "$OUT/pages-key"`; `rm "$OUT"/pages-key*`; `gh workflow run pages --repo vincenzoml/naima-dev`; once the product has `gh-pages`: `gh api -X PUT repos/vincenzoml/naima/pages -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/'`. Until then Pages keeps serving its last deployment (the clone installer). Afterwards the site deploys from `naima-dev`'s `.github/workflows/pages.yml` to the product's `gh-pages`.
8. Prove: `curl -fsS https://vincenzoml.github.io/naima/install.sh | head -3`; in a new empty git repository `curl -fsSL https://vincenzoml.github.io/naima/install.sh | sh`, then `find naima-tracker/naima -name '*.test.ts' | wc -l` is 0, there is no `naima-tracker/naima/AGENTS.md` or `naima-tracker/naima/naima-tracker`, and `deno run -A naima-tracker/naima/naima.ts check` passes.
9. Later updates of the stable clone: product change pushed to the product's `main`, then in the workshop `deno task naima update` and commit `naima-tracker/` with the new submodule pointer. Then migrate the paper repository and any other host by rerunning the installer (one commit each).

Rollback after step 4: `git revert` P on the product (an ordinary commit), the Pages source back to GitHub Actions.
