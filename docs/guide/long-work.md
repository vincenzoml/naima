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
it may write a line to the file named by `$NAIMA_RUN_PROGRESS` to say how far
it is.

## Wait for it, see it, stop it

```sh
naima wait bench --timeout 9m     # blocks until it ends, or 9 minutes pass
naima run list                    # every run: state, time and disk against the budgets, progress
naima run status bench --tail 50  # one run, with the end of its log
naima run stop bench              # end it now
```

`naima wait` prints how the run ended — succeeded, failed with its exit code,
killed by a budget, stopped — with the end of its log, and exits 0 only when
it succeeded. If the run is still going when the timeout passes, it says so
and exits 1: waiting again is a decision, never an accident.

`naima run list` marks two kinds of runs in capitals: **STALE**, still
running but silent (neither the log nor the progress file has changed for
`--stale`, 15 minutes by default), and **LOST**, whose supervisor stopped
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
