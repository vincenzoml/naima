# Configure the project

A project that needs nothing else configures nothing: every first-party
[plugin](glossary.md#plugin) is on, with defaults worked out from the
repository. When you do need something, it goes in one file,
`naima-tracker/naima-data/naima.json`, under `plugins`. Edit it in your
editor, run `naima check`, and commit it.

Every key and its default: [configuration](config.md).

## Add a release gate

```json
{
  "plugins": {
    "gates": { "options": { "gates": {
      "v1": { "title": "First release", "says": "what the first release waits on", "holdsOn": "code" }
    } } }
  }
}
```

Then put [items](glossary.md#item) on it with `naima set <item> gate=v1`, and ask with
`naima gates v1`. What `holdsOn` means: [gates](read-the-board.md#gates).

## Define the values a field takes

`area` and `kind` are free text until the project lists their values. A
list keeps a value from being a guess that sorts like a fact: each value has
a title and says what it means.

```json
{
  "extends": [
    { "field": "area", "values": {
      "cli": { "title": "Command line", "says": "the naima command and its output" },
      "docs": "the guide and the reference"
    } },
    { "field": "kind", "values": { "code": "a change to the program", "tester": "a gesture the tester role performs" } }
  ]
}
```

A value is what it means, or `{ "title", "says" }`. A plugin can add values
to the same list, the same way. The list is open: `naima check` reports a
value off it as a note, naming the items that hold it, and changes none of
them — define the value, or set those items to one on the list, yourself.
To make an off-list value fail the check, weigh the core's `values` check
`problem` (below). `naima types` prints every list, each value with how many
items hold it, values off the list marked.

`gate` and `epic` are closed lists already: a gate's values are the gates
contributed, an epic's the epics filed; anything else fails the check.

Add a value in the commit that first uses it, with its meaning.

## Make a check stricter, or quieter

Each [check](glossary.md#check) is weighed `problem` (fails `naima check`),
`note` (reported only) or `off`, under the plugin that declares it:

```json
{ "plugins": { "core": { "checks": { "duplicates": "problem" } } } }
```

The [reference](../reference/reference.md) says which plugin declares which
check.

## Switch a plugin off

```json
{ "plugins": { "beta-markers": { "enabled": false } } }
```

Everything that plugin declares — its types, fields, checks, commands — is
gone while it is off.

## Give a plugin its options

```json
{ "plugins": { "beta-markers": { "options": { "paths": ["src"] } } } }
```

Every plugin's options, with their defaults: [reference](../reference/reference.md).

## Keep Naima out of your own tools

Some tools — `deno check`, `tsc`, `prettier` — read every file in the project
and would read Naima's program files. `naima init` prints the line that
excludes `naima-tracker/naima/` from each configuration it finds;
`naima init --write-excludes` writes them
([the host's own tools](install.md#the-hosts-own-tools)).

## Move the data

The data directory can live anywhere in the repository: move it with
`git mv`, then run Naima with `naima --data <dir>` or `NAIMA_DATA=<dir>`, and
say so in the tracker's README ([moving things](tracker-folder.md#moving-things)).

## Add a plugin someone gave you

[Its own page](add-a-plugin.md).
