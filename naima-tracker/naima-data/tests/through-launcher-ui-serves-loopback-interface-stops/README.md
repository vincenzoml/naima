# Through the launcher, ui serves on the loopback interface and stops on Ctrl-C, while another command cannot listen (test/launcher.test.ts, on Deno, Node and Bun)

Run `deno test -A test/launcher.test.ts`. Through the real launcher in a fresh project: a probe command that tries to listen on 127.0.0.1 is refused with NotCapable; `naima ui --no-open` prints its address, answers it (302 with the token, 403 without), and exits 0 on a Ctrl-C sent to the process group.

Result 2026-10-01: 5 of 5 passed on Deno; the suite passed on Node and Bun too.
