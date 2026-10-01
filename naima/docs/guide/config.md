# Configuration

Every key of `naima-tracker/naima-data/naima.json`. The common tasks, step by
step: [configure the project](configure-the-project.md). Terms:
[glossary](glossary.md).

## The automatic principle

Naima is automatic first. Every first-party plugin — `trackers`,
`coordination`, `triage`, `gates`, `beta-markers`, `verifier`, `docs`, `rules` — is
loaded, and every default is inferred from the repository: beta markers are
looked for in every file git tracks (or would track), and the docs check
follows the links of every tracked markdown file. The program in
`naima-tracker/naima/` is never one of the project's files, even when it is
committed. A project that needs nothing else configures nothing.

`naima-tracker/naima-data/naima.json` holds only what the tool cannot infer:

- the **formats** of the data, and the **lock**: which Naima runs the project
  (`source`, `commit`, optionally `verify`), and how it is carried (`carry`, `program`);
- the **`plugins` table**: what the project decides about a plugin — its
  options (the project's [gates](glossary.md#gate) are the `gates` plugin's), a plugin switched
  off or replaced, a third-party plugin added, a check weighed differently.

- the project's own **extensions** of the loaded plugins' types and fields,
  under `extends`: a status added to a type, a type made `fixable`, an enum
  value added, the list of values `area` or `kind` takes
  ([extending](../reference/plugin-contract.md#extending-another-plugins-types-and-fields);
  [value lists](configure-the-project.md#define-the-values-a-field-takes)).

`naima init` writes the formats and the lock; nothing else is needed. Every
key, with its default: [the format](../reference/format.md#naimajson).

## The plugins table

`plugins` maps a plugin's name to what the project decides about it. A
first-party plugin the table does not name is loaded as it is.

```json
{
  "plugins": {
    "gates": { "options": { "gates": { "v1": { "title": "First release", "holdsOn": "code" } } } },
    "docs": { "options": { "reference": "docs/reference.md" }, "checks": { "links-resolve": "note" } },
    "beta-markers": { "enabled": false },
    "trackers": { "replacedBy": "plugins/my-trackers.ts" },
    "core": { "checks": { "duplicates": "problem" } },
    "mine": { "source": "plugins/mine.ts", "options": { "strict": true } }
  }
}
```

`naima plugin` turns a plugin on or off, or sets one of its options, without
a hand-edit: `naima plugin enable <name>`, `naima plugin disable <name>`,
`naima plugin set <name> <option>=<value>...` (an empty value removes it),
and `naima plugin show [<name>]` to see what is set now, and what a plugin's
options are. It refuses a name that is neither first-party nor already in the
table with its own `source`, and an option a plugin does not declare — the
case this exists for is an opt-in plugin that starts a program, such as
`verifier-mcrl2`: `naima plugin enable verifier-mcrl2` then
`naima plugin set verifier-mcrl2 bin=/usr/local/bin`. Switching a plugin's
`checks`, and adding a third-party plugin's `source`, are still a hand-edit.

| Key | Default | What it is |
|---|---|---|
| `options` | `{}` | the plugin's own options, as its reference documents them: the `gates` plugin's `gates`, the `docs` plugin's `reference`, `beta-markers`' `paths` |
| `enabled` | `true` | `false` switches the plugin off: it is not loaded, and nothing it declares exists |
| `replacedBy` | none | for a first-party plugin: the module that runs under its name instead — a fork, or an alternative |
| `source` | none | for a third-party plugin, required: its module, pinned (below) |
| `checks` | `{}` | check name → `off`, `note` or `problem`: how much each of the plugin's checks weighs here |

The name is the project's: a plugin is registered under the name its entry
has, whatever its manifest says, so a replacement keeps the name of what it
replaces. A name is lowercase letters, digits and dashes, starting with a
letter.

`core` is the core's own entry. The core cannot be switched off or replaced,
and takes no options; only its checks can be weighed.

### Check severity

As a linter weighs its rules, a project weighs each check: `problem` fails
`naima check`, `note` is reported and never fails it, `off` is not run. A
check the plugin does not declare is refused when the project loads, so a
misspelt name is never a silent no-op. The reference documents every check
as its plugin weighs it.

### Gates

The `gates` plugin's `gates` option maps a gate name to
`{ "title", "says", "holdsOn" }`. How a gate decides is in the
[reference](../reference/reference.md#gates). Format 1 kept it as a top-level `gates` key;
the `gates` plugin's own migration moves it here.

## Third-party plugins

Code runs from a pinned source, never from the data or from a package. A
third-party plugin's entry names it in `source`, with optional options:

```json
{
  "plugins": {
    "mine": { "source": "plugins/mine.ts" },
    "tools": { "source": { "path": "tools/naima-plugin.mjs", "sha256": "…" }, "options": { "strict": true } },
    "ops": { "source": { "git": "https://example.org/ops-plugin.git", "commit": "…", "path": "index.mjs" } }
  }
}
```

- a **path inside the program**: a module a fork of Naima carries
  ([modifying Naima](install.md#modifying-naima)); a path that leaves the
  program is refused;
- a **file of the project** with its **sha256**: refused, naming the new
  hash, the moment the file changes, until the pin is updated;
- a **git repository** at a full **commit**, with the module's path in it:
  fetched once into `naima-tracker/plugins/<name>/`, ignored by git, and
  refused when that checkout has local changes.

`replacedBy` takes the same shapes. A `source` on a first-party name is
refused: it is already loaded, and `replacedBy` is how it is replaced. The
module's default export is a factory that takes the options and the plugin
API and returns the manifest, which says the contract it is written for
([plugin contract](../reference/plugin-contract.md#shape)). Two plugins declaring the
same name is an error when the project loads.
