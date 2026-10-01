# The owner reads the tutorial and the guide and finds them clear without the code

The gesture: the owner reads, in order, `docs/README.md` (the map),
`docs/guide/tutorial.md`, `docs/guide/README.md` and every how-to page it
lists, and `docs/guide/rules.md`, as a person who never opens `src/`.

It passes when:

- every step of the tutorial can be followed as written, and nothing needs
  the code to be understood;
- each everyday task has a page, and the page answers the task;
- every rule is on the rules page once, marked enforced or convention, and
  no other page (the skill, `AGENTS.md`, the agent pages) restates one;
- no term is left unexplained: each links the glossary or says what it is.

It fails on any page that does not read clearly; note which, and what.

`runBy: human`, `humanBecause: judgement`: whether documentation reads
clearly to a person is a judgement no instrument settles.

## Result

Not yet performed.
