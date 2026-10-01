# Bun's 5-second default test timeout can fail the dist tests under load

Seen on 2026-10-01 on branch claude/runtime-folder: `bun test ./test/` run
right after `node --test` failed 2 of 195 tests in `test/dist.test.ts`. Both
were stopped by Bun's default 5000 ms timeout, and the git child process was
killed (`git -c: git failed`). The same command rerun at once passed 195 of
195. The tests copy the repository and build dist commits, which take about
5 s each when the machine is loaded.

The gesture that proves a fix: run `bun test ./test/` three times in a row,
with another test run going at the same time. Every run passes.
