# Requirements type: what the result must satisfy, proven by tests

The owner's point 9 (planning) asks for requirements and specifications as items, not only implied by tests. Today a requirement lives in prose or in a test's title: nothing says which requirements exist, which are proven, and which have nothing behind them.

Done: a `requirements` type in a planning plugin; a requirement is linked `satisfied-by` from the features, tests or epics that deliver it, and `verified-by` the tests or properties that prove it; it is met only when a proof has passed and none refutes; a check notes one that is proven but still open, and refuses one marked met without a passing proof; a view traces every requirement to what delivers and proves it; documented for people and agents.
