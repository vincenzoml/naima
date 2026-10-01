# A command to enable or configure a plugin in naima.json

A worker had to hand-edit naima.json to switch on the mCRL2 verifier (plugins.verifier-mcrl2) because no command does it. Every agent action should go through a command, never a hand-edit of the tracker's own config.

Done: a command (e.g. 'naima plugin enable <name>' or similar) that turns a plugin on/off and sets its options in naima.json, validated the way naima set validates item fields, instead of requiring a direct edit of the file.
