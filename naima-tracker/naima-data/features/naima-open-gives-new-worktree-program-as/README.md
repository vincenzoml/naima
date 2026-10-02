# naima open gives the new worktree its program as a local clone of the current one

Part of the epic "Product repo is the install; development in naima-dev"
(section "Fresh clones and worktrees of a host").

## Definition of done

- [ ] After `git worktree add`, `naima open` runs `git clone --local
  <this worktree>/naima-tracker/naima <new worktree>/naima-tracker/naima`,
  sets its `origin` to the source URL in `naima.json`, and checks out the
  locked commit: no network.
- [ ] When the current worktree has no program clone, `naima open` says so in
  one line and leaves the worktree to align on its first run.

## Files

`naima/src/plugins/coordination/index.ts` (or the module of the `open`
command inside that plugin), its test under `test/plugins/coordination/`.
It calls unit 1's exported alignment function and changes nothing in
`naima/src/core/`.

Sequential: after unit 1.

## Proving gesture

A test on Deno, Node and Bun with the network forbidden (`GIT_ALLOW_PROTOCOL=file`
and a source URL that does not resolve): `naima open` on a fixture host; the
new worktree's `naima check` passes and its program `HEAD` is the locked
commit.
