# With mCRL2 installed, the live mCRL2 case-study test exceeds Bun's 30-second per-test limit, and the site test was unformatted: the full gate failed on a clean checkout

Found by the release's pre-release stage on a clean clone of main at 2ca504b: bun test failed 1 of 381 (the live mCRL2 run over the VoxLogicA 2 scheduler model, six model-checker runs, timed out at 30 s), and deno task verify failed on deno fmt --check of test/site.test.ts. Fixed in fc2df2e: a 600 s limit on that test, and the file formatted. Bun reran the case-study and verifier tests: 14 pass, 0 fail.
