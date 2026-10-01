# An mCRL2 model of the coordination protocol, verified by Naima's own verifier plugin

The coordination plugin rests on a protocol: each session writes only its own
files (claims, session notes) on its own branch; collections are recombined at
read time from every branch worth reading; merges into the trunk are
fast-forward only. Its safety claims are stated in prose and tested by
example. They should be proven.

Mu-calculus properties to state (for example "no claim is ever lost"):

- no two sessions ever write the same path;
- a record committed on an unmerged branch is visible from every checkout;
- a fast-forward merge never discards a record;
- releasing the last claim leaves no claim behind on that branch.

The model lives in this repository and is filed as a property item, so
`naima verify` proves it (`mcrl22lps` → `lps2pbes` → `pbes2bool`) and
`naima check` fails when the model changes without a new run.

- [ ] write the model
- [ ] file each property as a `properties` item pointing at it
- [ ] verify with the mCRL2 adapter
