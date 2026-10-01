# TLA+ specification of the coordination protocol, verified by Naima's own verifier plugin

The coordination plugin rests on a protocol: each session writes only its own
files (claims, session notes) on its own branch; collections are recombined at
read time from every branch worth reading; merges into the trunk are
fast-forward only. Its safety claims are stated in prose and tested by
example. They should be proven.

Properties to state:

- no two sessions ever write the same path;
- a record committed on an unmerged branch is visible from every checkout;
- a fast-forward merge never discards a record;
- releasing the last claim leaves no claim behind on that branch.

The specification lives in this repository and is filed as a property item,
so `naima verify` proves it and `naima check` fails when the spec changes
without a new run.

- [ ] write the spec
- [ ] file each property as a `properties` item pointing at it
- [ ] verify with the TLC adapter
