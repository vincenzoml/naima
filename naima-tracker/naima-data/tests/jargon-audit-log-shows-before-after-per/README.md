# Jargon audit log shows before/after per page and the link checks still pass

Open the audit log, naima-tracker/naima-data/todos/jargon-audit-docs-site-skill-plain-english/attachments/jargon-audit-2026-10-01.md, and the two fixed pages, naima/docs/guide/concepts.md and naima/docs/guide/install.md.

Must show: a before/after row per finding (not a single aggregate number), the method used for each of the four checks, and that the CJK acronym and the webview term no longer appear unexplained in their pages. Then run `deno task verify` and confirm the link checks (`links-resolve`, `docs-pages`) still pass, same as before the edits.
