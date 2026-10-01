# Case study: the parallel scheduler of VoxLogicA 2

The product-level case study of the Naima paper: the scheduler of the spatial
model checker VoxLogicA 2, modelled in mCRL2, its four properties filed as
Naima property items and checked by the `verifier-mcrl2` plugin with
`naima verify`.

## The system

VoxLogicA 2 evaluates an image-analysis program as a graph of tasks. Its
execution engine (`implementation/python/voxlogica/engine/` in the VoxLogicA 2
repository) is a single asyncio event loop that owns the scheduling state,
and a pool of worker coroutines that hand each kernel to a thread. The parts
this model keeps, and where each lives in the engine:

| Part | In the engine | In the model |
|---|---|---|
| Task graph, shared subterms | every node is identified by a content hash of its expression, so a subterm used by several consumers is one node (`node_table.py`, `graph.py`) | `deps`; the instance shares `A` among `B`, `C` and `E` |
| Registration | `_schedule_subgraph` (`core.py`) discovers the subtree, then wires pending counts; `graph.register` and completion fire a node when its count reaches zero | `offer(t)` once every dependency is in `comp` |
| Ready heap | `ReadyQueue` (`ready.py`): a priority heap, newest first at equal priority | `ready`; any task may be popped, so every pop order the heap can choose is covered |
| Memory parking and the progress floor | `_enqueue` parks a ready node when accounted bytes exceed the soft budget and the heap already holds a node per worker; `_maintain`, run at the end of every worker turn and by the watchdog, unparks under the budget, and over it when the heap holds fewer nodes than workers ("starving"), except at the hard ceiling while something runs or is ready | `park`, `unpark`, `mem` (`under`, `soft`, `hard`), `progressFloor` |
| Duplicate offers | a node can be pushed again — a shared path, the reload deferral in `_worker` | `reoffer(t)`, at most once per task |
| The duplicate guard | a worker skips a popped node that is completed or running (`_worker`, `core.py`); without the running half, a duplicate reached `table.begin` and raised `DoubleComputationError` | `drop(t)`, `dupGuard` |
| Workers | `max_concurrency` coroutines; a kernel reads its inputs from the value table | `start(t)` when fewer than `workers` run; the value is computed from `vals` at start |
| Completion | `_finish` records the value and fires dependents; memory may be released | `done(t)`, then `value(t, v)`; `mem` may fall to any lower level |
| Memory pressure | the governor's budgets, from RSS | `pressure`: the environment raises `mem`; it falls only at a completion, the adversarial case |
| Run completion | `outstanding` reaches zero (`ready.py`) | `finished`, when the goal is computed and nothing is ready, parked or running |

Left out, each a model of its own: eviction, spilling and the pin protocol
of a dispatch (the use-after-evict race), loop expansion and admission,
schedule-time fusion, the persistent cache, priorities. The instance is
small: five tasks with a subterm shared by three consumers, two workers.

## The properties

Each is a property item of Naima's own tracker, with `verifier=mcrl2`,
`model` the specification here and `property` its formula file:

| Property | Formula | States in words |
|---|---|---|
| Deadlock freedom | [deadlock-freedom.mcf](deadlock-freedom.mcf) | until the run finishes, the scheduler can always take a step of its own |
| Exactly once | [exactly-once.mcf](exactly-once.mcf) | no task starts twice, the shared one included, and none is left unstarted at the end |
| Dependency order | [dependency-order.mcf](dependency-order.mcf) | no task starts before each task it depends on is done |
| Determinism of results | [determinism.mcf](determinism.mcf) | every task's value equals its sequential evaluation, `ref`, whatever the interleaving |

## The negative experiments

Two copies of the model each switch one safeguard off, and nothing else (a
test holds them to that, `test/case-studies/voxlogica-2-scheduler.test.ts`):

- [scheduler-no-guard.mcrl2](scheduler-no-guard.mcrl2), `dupGuard = false`:
  exactly once must be violated — a duplicate offer of a running task is
  started a second time;
- [scheduler-no-floor.mcrl2](scheduler-no-floor.mcrl2),
  `progressFloor = false`: deadlock freedom must be violated — over the soft
  budget, parked work is never admitted once nothing runs.

## Running it

```sh
naima verify <property>            # each of the four, from Naima's tracker
deno test -A test/case-studies/    # the same verdicts, and both negatives, where mcrl22lps is on PATH
```

A negative run outside the tracker: `mcrl22lps scheduler-no-floor.mcrl2 m.lps`,
`lps2pbes --counter-example --formula=deadlock-freedom.mcf m.lps m.pbes`,
`pbessolve --file=m.lps --evidence-file=e.lps m.pbes`, `lps2lts e.lps e.aut`:
the counterexample is `e.aut`.

## Results

| Property | Model | Verdict | States | Time |
|---|---|---|---|---|
| Deadlock freedom | scheduler.mcrl2 | not yet run | | |
| Exactly once | scheduler.mcrl2 | not yet run | | |
| Dependency order | scheduler.mcrl2 | not yet run | | |
| Determinism of results | scheduler.mcrl2 | not yet run | | |
| Exactly once | scheduler-no-guard.mcrl2 | not yet run | | |
| Deadlock freedom | scheduler-no-floor.mcrl2 | not yet run | | |

The verdicts come from `naima verify`, each attached to its property item;
the state count from `lps2lts --verbose` on each model.
