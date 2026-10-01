# Fix tied to code: a `commits` field, and `naima close` refuses without one

`fixedOn` is only a date. An audit of a comparable method found roughly a third of its closed bugs carry a commit hash, as routine weekly practice.

Done: fixable types carry `commits` (a list of hashes); `naima close` refuses an item with no commit reachable from the trunk; a check reports a hash that does not exist; the rules forbid retrofitting hashes by guessing; the tutorial is updated.
