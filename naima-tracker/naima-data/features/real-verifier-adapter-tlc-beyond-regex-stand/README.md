# A real verifier adapter (TLC) beyond the regex stand-in

Only the regex stand-in ships; the formal-methods core the vision promises is not built.

Done: a TLC adapter plugin maps TLC's exit status and output to a verdict, returns the error trace as the counterexample, declares its catalogue entry, with a fixture that runs in CI when TLC is present and is visibly skipped otherwise.
