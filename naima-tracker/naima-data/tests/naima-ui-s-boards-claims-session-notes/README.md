# naima ui's boards, claims, session notes and item views equal the CLI's --json

`deno test -A test/plugins/ui/ui.test.ts`, the test "beyond the first screen:
boards, claims and session notes across branches, an item's evidence": in a
git project with two bugs and a passed test verifying one, an attachment on
it, a claim and a session note committed on a second branch and another of
each on the trunk's working tree, `/data/board` (default and `?type=tests&all=1`),
`/data/claims`, `/data/notes` (default and `?n=1`) and `/data/item?item=<id>`
equal `naima board <type> [--all] --json`, `naima claims --json`,
`naima pass --list [n] --json` and `naima show <item> --json`. Claims and
notes come from both branches; the contested item is named; the item's
evidence lists the attachment and the passing test as proving; the pages
carry labelled controls, column headers, escaped titles and links to the item
view; the claims panel is on Home and no panel failed.

Pass: the test green on Deno, Node and Bun.
