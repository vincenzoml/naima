# Derived timeline view (`naima view timeline`)

'When did this gate open, when did that epic finish' invites a second, storage-backed event log that can disagree with the items and look authoritative while being wrong.

Done: the view derives each event from the items and git with nothing stored — a gate opened is its first item reported, a gate passed is its last item resolved, an epic the same way, a release is a version tag, a session is its note; undated things are counted at the foot, never placed at a guess; only what cannot be derived (a decision, a build handed out, a policy, an outside fact) needs a record, one file per event.
