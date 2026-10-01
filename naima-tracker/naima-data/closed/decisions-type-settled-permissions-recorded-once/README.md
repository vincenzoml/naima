# Decisions type: settled permissions recorded once

'A settled permission stays settled' is one sentence, nowhere recorded. An audit of a comparable method found this was never actually built there either — it lived in one authoritative business document with dated entries — so this is new ground, not a port; it should follow the reopen-trigger and authoritative-document-list pattern (see the related item on deferrals).

Done: a `decisions` type (one item per decision or standing permission, dated, the owner's words restated, what it supersedes); a decision links to the items it settles; the asking-the-human flow searches decisions before asking, and files the answer as a decision after; a check notes an open `runBy: human` item whose `humanBecause: decision` is linked to a settled decision; documented for people and agents.
