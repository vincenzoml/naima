# Project-declared gate set with ratcheting budgets (covers the metrics request)

Naima runs its own checks, but a project has nowhere to declare its gate set; the owner's 'metrics, planned' request is already daily practice elsewhere via ratchets: a count may fall, never rise; lowering it goes in the same commit; raising it to make a change fit is refused.

Done: `naima.json` lists commands, each with an expectation (exit 0; equal to a baseline; at most a budget; at least a floor); `naima gate-set` runs them all, prints old/new numbers, fails on an exceeded budget or an unlowered budget; raising a budget needs an item saying why; closing and coordination flows name it as 'the gates'; a test pins each expectation kind, red then green.
