#!/usr/bin/env -S deno run -A
// Naima. Run it with Deno from the project: deno run -A naima-tracker/naima/naima.ts <command>
// It runs the program under narrow permissions: src/launcher.ts, docs/guide/install.md.

import { launch } from "./src/launcher.ts"

Deno.exit(await launch(Deno.args, Deno.cwd()))
