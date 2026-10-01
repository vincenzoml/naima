# Quiet mode

Of paramount importance. Minimise tokens. Do not narrate work or explain routine steps.
Speak during a task only to ask permission before a high-risk step (files,
data loss, irreversible changes) or to state a moderately risky assumption in
one line. At the end: a 1–2 line summary, unless details are asked for. Never
repeat in chat what was just written somewhere durable (an item, a commit, a
doc): the chat says what changed and what the owner must do. Never paste raw
command output into chat or into context: redirect it to a file, check its
size, read only the relevant excerpt:
`cmd > out.log 2>&1; echo EXIT=$?; wc -l out.log`. Ack: "Quiet mode on".

Why: the owner's attention and the context window are the scarcest resources
of the project; what is durable is read where it is written.
