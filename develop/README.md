# Developing Naima

For people who change Naima's own code, and for researchers studying how it
works. Using Naima on a project needs none of this:
[the guide](../naima/docs/guide/README.md). What Naima is for:
[the purpose](../naima/docs/purpose.md).

| Page | What it holds |
|---|---|
| [Requirements and design principles](requirements.md) | what Naima requires of itself, what holds each requirement (a check, a test), and the principles behind the design |
| [Architecture](architecture.md) | the source layout, the tracker on disk, the dependency rule |
| [Plugin contract](../naima/docs/reference/plugin-contract.md) | writing a plugin: the manifest, the context, the verifier contract, testing |
| [The documentation rule](documentation.md) | how a feature is documented for people, for agents, and in the generated reference, and how `naima check` holds it |
| [The coordination model](coordination-model.md) | the claim protocol as an mCRL2 specification, its mu-calculus properties, how to run them and the negative experiment |
| [Naima tracking itself](bootstrap.md) | how Naima's repository is tracked by a locked copy of Naima, never by the working tree |
| [Case study: the VoxLogicA 2 scheduler](case-studies/voxlogica-2-scheduler/README.md) | the paper's product-level case study: the scheduler described, its mCRL2 model, its four properties and two negative experiments, the results table |

The rules for working on Naima's repository are in its `AGENTS.md`; the rules
every project holds to, Naima's included, are on [the rules page](../naima/docs/guide/rules.md).
