# The agent flows exist and every link to them resolves

## Gesture

1. Open `docs/flows/README.md` and follow every link: each flow page opens.
2. Read each page: no project-specific names, paths, people or incidents;
   each says what to do and why.
3. `deno task naima check` passes, with `links-resolve` among its checks;
   break one link in `AGENTS.md` and it fails naming the file and line.

Pass: all three hold.

## Result

Not yet performed by someone other than the author.

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/u4-proofs

Full suite pass on main's head (commit 623fd87af5526fccdf685f4d0825ac0e062b4509). deno task verify: 220/220 passed, 0 failed. node --test test/**/*.test.ts: 220/220 passed. bun test --timeout 30000 ./test/: 220/220 passed. Logs kept as evidence in the session scratchpad (verify-deno.log, node-test.log, bun-test.log).
