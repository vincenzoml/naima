# Long work: run it, wait for it, clean up after it

A benchmark, a model-checking batch, a build that takes an hour: work that
outlasts a conversation with an agent. Naima starts it, bounds it, tells you
where it stands and removes what it left behind. An agent does all of this
for you; each command below is what it types, so you can check what it did.

## Start a run

```sh
naima run bench --budget-time 2h --budget-disk 20G --creates /tmp/bench-stores -- 'deno task bench > results.csv'
```

- `bench` is the run's name: lowercase letters, digits, `.`, `_`, `-`.
- `--budget-time` is how long it may last. It is required: past it, the run is
  ended — the command and everything it started.
- `--budget-disk` with `--creates`: what the run creates (stores, temporary
  folders) may not grow past this size; past it, the run is ended. The
  declared paths are also what `naima run clean` removes. A path that is your
  repository, a folder above it, your home folder, or one holding a file git
  tracks is refused.
- After `--`: one argument is a command line for the shell (pipes and `>`
  work); several are a program and its arguments, run exactly as given.

The command runs in the folder you start it from, with your environment,
detached: closing the session does not stop it. Its output goes to a log, and
it says how far it is in the file named by `$NAIMA_RUN_PROGRESS` (below).

## Say how far it is

Long work reports its progress: that is
[a rule](rules.md#long-work-reports-its-progress-or-says-why-it-cannot-and-what-it-reports-instead).
The command writes one line at a time to `$NAIMA_RUN_PROGRESS`; the last line
counts. A JSON object is read field by field, each field optional:

```sh
echo '{"stage":"render","done":12,"total":40,"unit":"frames"}' >> "$NAIMA_RUN_PROGRESS"
```

- `stage` — what it is doing now; `done`, `total`, `unit` — how much of it is
  done, of how much, of what;
- `note` — anything else worth saying;
- `overall` — `{ "done", "total", "unit" }` for the whole work around the
  stage, such as scenes around frames.

Any other line is shown as it is. Naima works out the rate and, when the total
is known, the time left, and shows them as
`render: 12/40 frames (30%) · 2/s · ETA 14s`. Naima's own commands — `naima
verify`, `naima metrics run`, `naima tools install` — write these lines by
themselves when they run inside `naima run`, and print them on the terminal
otherwise, once they have run for a couple of seconds.

A command that truly cannot say how far it is — a solver with no progress
output — is started with the reason instead:

```sh
naima run solve --budget-time 12h --no-progress "the solver prints nothing until it ends" -- ./solve.sh
```

It is then shown with its elapsed time and the last line of its log.

## Wait for it, see it, stop it

```sh
naima wait bench --timeout 9m     # blocks until it ends, or 9 minutes pass
naima run list                    # every run: state, time and disk against the budgets, progress
naima run status bench --tail 50  # one run, with the end of its log
naima run stop bench              # end it now
```

While it waits, `naima wait` prints every 30 seconds (`--report`) how long
the run has been going and its progress. Then it prints how the run ended —
succeeded, failed with its exit code, killed by a budget, stopped — with the
end of its log, and exits 0 only when it succeeded. If the run is still going when the timeout passes, it says so
and exits 1: waiting again is a decision, never an accident.

`naima run list` marks two kinds of runs in capitals: **STALE**, still
running but silent — no new progress line for `--stale`, 2 minutes by
default; for a run started with `--no-progress`, nothing new in its log or
progress file for 15 minutes — and **LOST**, whose supervisor stopped
reporting — killed, or the machine restarted — so nobody knows how it ended.

## Clean up

```sh
naima run clean bench
```

Removes the paths the run declared with `--creates`, then its record. It is
refused while the run is going, and it never removes a file git tracks.

## On another machine

A machine is declared once, in `naima.json`:

```json
"long-work": { "options": { "hosts": {
  "lab": { "ssh": "me@lab.example.org", "dir": "/home/me/project" } } } }
```

Then `naima run bench --host lab --budget-time 6h -- 'deno task bench'` runs it
there, through the copy of Naima that machine already has for the project;
`wait`, `run list`, `run status`, `run stop` and `run clean` ask it over ssh.
A run on another machine must not change files the repository tracks there:
if it does, it is reported failed, naming them.

## Where the records are

Each run has a folder in `naima-tracker/.runs/<name>/`: what was asked
(`run.json`), its state (`status.json`), its `log` and its `progress`. The
folder ignores itself, so nothing of it is ever committed.

## Platforms

macOS and Linux: everything above. Windows: local runs, ended with `taskkill`;
a Windows machine cannot be a `--host`. The rule that makes these commands
mandatory for agents: [long work goes through naima run](rules.md#long-work-goes-through-naima-run-and-naima-wait).
The rule that it says how far it is:
[long work reports its progress](rules.md#long-work-reports-its-progress-or-says-why-it-cannot-and-what-it-reports-instead).
