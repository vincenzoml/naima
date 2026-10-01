# Add a plugin someone gave you

A colleague, or another project, hands you a [plugin](glossary.md#plugin): a
file, or a git repository. You do not need to read its code to add it, but you
decide to trust it — it runs inside Naima. Naima runs it only pinned, so what
runs is exactly what you reviewed
([the rule](rules.md#third-party-code-runs-only-pinned)).

## A file

1. Put it in the project, for example `tools/hello.mjs`, and commit it.
2. Find its fingerprint (its sha256):

   ```console
   $ shasum -a 256 tools/hello.mjs
   91532e4fc03758f98e3e2721b64f12d26c7e42536ae7c1bca388f8edb48ac96c  tools/hello.mjs
   ```

   On Windows: `Get-FileHash tools/hello.mjs`.

3. Name it in `naima-tracker/naima-data/naima.json`, with that fingerprint.
   The name, `hello` here, is yours to choose: lowercase letters, digits and
   dashes.

   ```json
   {
     "plugins": {
       "hello": { "source": { "path": "tools/hello.mjs", "sha256": "91532e4fc03758f98e3e2721b64f12d26c7e42536ae7c1bca388f8edb48ac96c" } }
     }
   }
   ```

4. Check it, and see it loaded:

   ```sh
   naima check
   naima plugins
   ```

When the file changes, every command refuses until you pin the new
fingerprint, and says it:

```console
$ naima check
naima: naima.json: plugins.hello: tools/hello.mjs has changed since it was pinned: its sha256 is 91532e4fc03758f98e3e2721b64f12d26c7e42536ae7c1bca388f8edb48ac96c, not 0000000000000000000000000000000000000000000000000000000000000000 — review it, then pin the new hash
```

Review what changed, then copy the new fingerprint into `naima.json`.

## A git repository

Name the repository, the full commit to run, and the file in it:

```json
{
  "plugins": {
    "ops": { "source": { "git": "https://example.org/ops-plugin.git", "commit": "<the full 40-character commit>", "path": "index.mjs" } }
  }
}
```

The first run fetches it into `naima-tracker/plugins/ops/`, which git ignores.
To move to a newer version, change `commit`.

## Its options

If the plugin takes options, they go beside `source`:

```json
{ "plugins": { "hello": { "source": { "path": "tools/hello.mjs", "sha256": "…" }, "options": { "strict": true } } } }
```

What it adds — commands, types, checks — is in its own documentation, and in
`naima docs`, which prints the reference of every loaded plugin, this one
included.

## Removing it

Delete its entry from `plugins`. Its items, if it added a type, stay on disk;
`naima check` reports a folder no loaded plugin owns (the check `layout`).

Writing a plugin of your own: [plugin contract](../develop/plugin-contract.md).
