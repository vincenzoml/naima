# naima attach records consent; attachment-consent and secrets checks catch what a branch adds (test/plugins/privacy/privacy.test.ts, on Deno, Node and Bun)

Run the privacy plugin's tests on each runtime: `deno test -A test/plugins/privacy/`, `node --test test/plugins/privacy/privacy.test.ts`, `bun test --timeout 30000 ./test/plugins/privacy/`. A pass is every test green on all three: six secret shapes each caught once and a private-key header with no body not flagged; a secret in a project file and in an attachment reported; an exception without a reason and an item refused, one matching nothing a note, one not on the trunk refused; `naima attach` refusing without --consent or --own, with both, over a taken name, and on a file holding a secret, and recording the owner's yes; `attachment-consent` flagging a hand-copied attachment, a record with no file and the owner's file with no yes, and not flagging what the trunk holds, even moved to another item.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u7-privacy

Passed on claude/u7-privacy at 851f5d5 (main merged in): deno task verify 241 passed, 0 failed, both checks green; node --test 241 pass, 0 fail; bun test --timeout 30000 241 pass, 0 fail. Red seen first: the module did not exist; then the secrets check flagged this repository's own evidence once main had closed items, which led to grandfathering by content rather than path. Logs in the session scratchpad (u7-privacy/verify.txt, node.txt, bun.txt).
