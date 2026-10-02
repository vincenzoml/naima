# Outward: rename to naima-dev, create the product repository, move the site, migrate the trackers

Part of the epic "Product repo is the install; development in naima-dev"
(section "GitHub moves"). Outward-facing: the coordinator and the owner do it,
never a worker. Every step changes GitHub; steps 2 and 4 are the irreversible
ones and need the owner's go.

## Definition of done

- [ ] 1. Tag `pre-split` on the monorepo `main`; push it.
- [ ] 2. Rename `vincenzoml/naima` to `vincenzoml/naima-dev` (owner).
- [ ] 3. `git remote set-url origin https://github.com/vincenzoml/naima-dev.git`
  in every local clone of the workshop.
- [ ] 4. Create the empty public `vincenzoml/naima` (owner); push the split
  `main`, the mapped tags and `refs/legacy/main` (`scripts/split.sh` with the
  real remotes).
- [ ] 5. Deploy key on the product, secret `PRODUCT_DEPLOY_KEY` on `naima-dev`,
  product Pages from `gh-pages`, Pages off on `naima-dev`; push the workshop's
  restructure commit; the site deploys.
- [ ] 6. Migrate Naima's own tracker in `naima-dev` (installer rerun, one
  commit), then the paper repository and any other host.
- [ ] The paper's repository URL and artifact names (the open todo about the
  public repository URL named in the paper) say which repository holds what.

## Files

None in this repository besides `naima-tracker/naima-data/naima.json` (step 6).

Sequential: last, after unit 6.

## Proving gesture

`git clone https://github.com/vincenzoml/naima` holds exactly the product
files; `curl -fsS https://vincenzoml.github.io/naima/install.sh | sh` installs
into a fresh repository and `naima check` passes; in `naima-dev`, `deno task
naima check` runs the stable clone; a v1.0.0 host that has not migrated still
aligns (its locked commit is fetched through `refs/legacy/main`).
