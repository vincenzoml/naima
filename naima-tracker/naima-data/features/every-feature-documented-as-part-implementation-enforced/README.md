# Every feature is documented as part of its implementation, enforced by naima check

The owner's rule, for this repository and offered to every project that uses
Naima: *"Features are documented always, as part of their implementation."* A
feature is not done until its documentation is in the same change.

What a project switches on by loading the `docs` plugin:

- every loaded contribution — plugin, command (with an example and every
  `--flag` its usage names), item type and status, field and enum value,
  relation, check, view, gate (and how it decides), verifier, plugin option —
  carries its documentation in its own manifest, and `naima check` fails when
  one does not;
- `naima docs` prints the reference generated from those manifests, so it
  cannot drift; with the `reference` option set, `naima check` fails when the
  file on disk differs from what the code generates;
- a feature item in a done status (`shipped` by default) names its
  documentation in `docs`, and `naima check` fails when a named file or heading
  does not exist;
- relative links in the configured markdown files resolve, so the flows an
  agent instruction names exist.
