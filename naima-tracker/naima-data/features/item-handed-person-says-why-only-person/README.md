# An item handed to a person says why only a person can do it

The owner's rule: *"Don't ask the human if you know the answer."* Decide, act,
report; ask only for what is genuinely the owner's.

Where it can be expressed mechanically: an open item whose proof is marked
`runBy: human` must say why in `humanBecause` — a judgement, a reserved
decision, a credential, or a physical act. `naima check` fails when it does
not, and `naima queue --human` prints the reason next to each item. The rest
of the rule is in the agent flows.
