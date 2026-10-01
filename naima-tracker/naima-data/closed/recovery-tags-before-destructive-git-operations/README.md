# Recovery tags before destructive git operations

Deleting an unmerged branch, or a bulk sweep, cannot be undone without a ref; this cost a comparable project real branches.

Done: the closing and pruning flow pages say to tag `archive/<branch>` before deleting a branch with unmerged commits, and `checkpoint/<date>-<what>` before a bulk tracker sweep; `naima prune` refuses to delete a branch with unmerged commits and no archive tag.
