# Code metrics read the files of a git submodule

Part of the epic "Product repo is the install; development in naima-dev"
(section "Metrics"). After the split `naima-dev/naima` is a submodule, and the
code measure reads files through `git ls-files` and `git ls-tree`, which stop
at a gitlink: every code metric of `naima-dev` would read `naima/src` as empty.

## Definition of done

- [x] The working-tree measure lists files with `ls-files --recurse-submodules`.
- [x] The past-commit measure (backfill) follows a gitlink entry of `ls-tree -r
  <commit>` into the submodule's repository (`.git/modules/<path>` or the
  submodule's own `.git`) and reads that commit's files; a gitlink whose
  commit is absent is reported in one line and counted as no files.
- [x] `include` paths name files inside a submodule as they name any other.
- [x] A project without submodules measures exactly as before.

## Files

`naima/src/plugins/metrics/code.ts`, a test under `test/plugins/metrics/`.

Independent: can start at once, in parallel with unit 1.

## Proving gesture

A test on Deno, Node and Bun: a fixture repository with a submodule holding
`src/a.ts`; `metrics run loc` and `metrics backfill` over two commits report the
submodule's lines, equal to the count of the same files committed inline.
