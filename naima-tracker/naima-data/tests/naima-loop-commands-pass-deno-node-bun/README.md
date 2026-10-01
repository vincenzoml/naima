# Naima loop commands pass on Deno, Node and Bun

Run `test/plugins/loop/loop.test.ts` on Deno (`deno task test`), Node
(`node --test`) and Bun (`bun test`). They were red before the
implementation (the plugin did not exist) and are green after it: refusal
without a target or on an unknown one, a work list with no steps refused,
a work list stopping when every line is done or deferred, `--every`
overriding the plugin's `every` option, `--check` exiting 1 while not
stopped, an epic stopping when only the owner's items are left with the
decision ordered before the judgement, the untried gesture listed, and a
gate stopping when it holds only a build.

## Result

What was seen, when, and by whom.
