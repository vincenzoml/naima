# Trunk-commit detection while a branch is being prepared

'Never commit on the trunk without asking' is only a convention because nobody records that a branch is being prepared; an audit of a comparable method found this daily practice there.

Done: a claim can carry `preparing: true`; `naima check` on the trunk notes a commit made after a live preparing claim's base; the closing flow sets and clears the flag; covered by a coordination test.
