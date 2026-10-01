# The mCRL2 verifier writes its run files in the system temporary directory, outside the launcher's write fence, so every real run ends in error

The first real run of `naima verify` on the coordination-model properties,
with the mCRL2 toolset 202607.0 installed, gave verdict `error` on both: the
`verifier-mcrl2` plugin made its working directory with
`mkdtempSync(tmpdir())`, and the launcher (`naima/src/launcher.ts`) grants
write access only to the tracker, the data, the program and the per-user
cache. Deno refused the write ("Requires write access to /var/folders/..."),
so no mCRL2 tool ever started. The replayed tests ran with `-A` and never saw
the fence.

Fix: the run's files go under the per-user cache (`NAIMA_CACHE`, which the
launcher sets and fences in), in `verifier-mcrl2/`; the system temporary
directory only when there is no cache. `workBase` in
`naima/src/plugins/verifier-mcrl2/index.ts`, tested in
`test/plugins/verifier-mcrl2/mcrl2.test.ts`.
