# Test runs leave naima ui processes running and the suites hang

Running the test suites leaves 'naima ui --no-open' processes (a deno server and its sandboxed child) alive from a temporary launcher project, and a node --test runner keeps waiting on them: a worker's gates were seen running for over an hour, with processes 81 minutes old. Expected: every test that starts ui stops it on every path, and a suite that hangs fails within a bounded time.
