# The reference is current and every loaded contribution is documented

## Gesture

1. `deno task verify` passes.
2. Remove the `examples` of any command in `src/`; `deno task verify` fails
   naming the command. Restore it.
3. Change any `says` in a manifest without running `deno task docs`;
   `deno task verify` fails saying `docs/reference.md` is out of date.

Pass: all three hold.

## Result

Not yet performed by someone other than the author.
