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
