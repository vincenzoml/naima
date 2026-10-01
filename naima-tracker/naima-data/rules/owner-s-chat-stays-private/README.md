# The owner's chat stays private

The conversation between the owner and an agent is private. Nothing from it is copied into the repository without the owner's explicit consent: reports, descriptions and notes are written in the agent's own words. A file or screenshot the owner shared becomes an attachment only after their explicit yes, recorded with it: `naima attach <item> <file> --consent "<their yes, restated>"`. The agent's own evidence goes in with `naima attach <item> <file> --own`, redacted first.

Why: the owner talks freely only if what they say stays theirs; an attachment is permanent once committed, so consent is asked before, never after.
