# External plugins: pinned sources, a CONTRACT version, and a frozen registry

## Behaviour

A project may load a plugin from outside the program directory: a pinned
local path or a pinned git source (URL plus commit), without forking Naima.
This closes the gap where `src/core/config.ts:96-110` only loads paths inside
the program today, and where `src/core/index.ts` exports nearly the whole
core (including `runCli` and `migrate`), making the documented rule "plugins
import only `core/index.ts`" toothless.

- A `CONTRACT` version is checked at plugin load time; a plugin declaring an
  incompatible contract version fails to load with a clear message instead of
  running against an API it was not written for.
- The core's public surface splits into `api.ts` (what a plugin may import)
  and `internal.ts` (everything else); an external plugin factory receives an
  injected API object rather than importing the core module tree directly.
- The plugin registry is frozen after `buildRegistry` runs (this also closes
  REVIEW.md R-48, where any plugin can delete another plugin's command today).

## Boundaries

- Ships after D-01 (plugin configuration table, which is where an external
  plugin's pinned source and options are declared) and D-02 (qualified
  names, needed before a third-party ecosystem exists to avoid silent
  collisions).
- Capability scoping between plugins (what an external plugin's injected API
  can and cannot do) is part of this feature's definition of done, not a
  follow-up.

## Documentation

`docs/plugin-contract.md` documents the `CONTRACT` version, the `api.ts`
surface, and how a project pins an external plugin source; `docs/config.md`
documents the corresponding `plugins` table entry shape.

Source: REVIEW.md section 2, decision D-10 (recommendation b); DECISIONS.md
line 11.
