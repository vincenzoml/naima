# The agent flows exist and every link to them resolves

## Gesture

1. Open `docs/flows/README.md` and follow every link: each flow page opens.
2. Read each page: no project-specific names, paths, people or incidents;
   each says what to do and why.
3. `deno task naima check` passes, with `links-resolve` among its checks;
   break one link in `AGENTS.md` and it fails naming the file and line.

Pass: all three hold.

## Result

Not yet performed by someone other than the author.
