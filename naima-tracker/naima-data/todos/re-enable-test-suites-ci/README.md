# Re-enable test suites in CI

The CI workflows were removed to avoid unnecessary runs and failure email notifications that consumed real budget. Tests now run locally before each push, which is sufficient for development. When budget becomes available or priorities shift, re-enable the test suites in the CI workflows.

The implementation should:
- Re-enable test jobs for Deno, Node, and Bun
- Run on Linux (ubuntu-24.04) and macOS (macos-15)
- Omit Windows install test (low priority)
- Disable or silence email notifications to minimize alert fatigue and budget use
- Keep the dist job for pushing the distribution branch on main

## Definition of done

- [ ] CI workflows restored with Deno, Node, Bun test jobs on Linux and macOS
- [ ] Dist job runs after all test jobs pass on main
- [ ] Email notifications are limited or disabled
- [ ] Tests run successfully on all supported platforms
