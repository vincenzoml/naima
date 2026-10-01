# Developing Naima

For people who change Naima's own code. Using Naima on a project needs none
of this: [the guide](../naima/docs/guide/README.md).

| Page | What it holds |
|---|---|
| [Architecture](architecture.md) | the source layout, the tracker on disk, the dependency rule |
| [Plugin contract](../naima/docs/reference/plugin-contract.md) | writing a plugin: the manifest, the context, the verifier contract, testing |
| [The documentation rule](documentation.md) | how a feature is documented for people, for agents, and in the generated reference, and how `naima check` holds it |
| [Naima tracking itself](bootstrap.md) | how Naima's repository is tracked by a locked copy of Naima, never by the working tree |

The rules for working on Naima's repository are in its `AGENTS.md`; the rules
every project holds to, Naima's included, are on [the rules page](../naima/docs/guide/rules.md).
