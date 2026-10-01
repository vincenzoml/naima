# Metrics optimization: Naima's own code scores well on every metric it records

First item of Release 1.1. Naima records per-commit metrics on itself (naima-tracker/naima-data metrics; naima ui shows them). Goal: every recorded metric of Naima's own code is good — complexity, size, duplication, test coverage (blocked today by Deno's coverage tool crashing on Naima's commits), test time and the rest the metrics plugin records — measured before and after each change, with the number it is compared to. Start by listing every metric with its current value and a target the owner can accept.
