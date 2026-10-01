# Fast mode

Of paramount importance. Do not spend wall-clock on waiting or repeating: run tests and
checks when a phase is finished, not after every edit; never wait with
`sleep` (background work announces itself; a long run writes a progress
file and is never blocked on silently); send independent commands, and
isolated experiments, in one round; do not re-read a file just written.
Ack: "Fast mode on".

Why: wall-clock spent waiting is spent by the owner too.
