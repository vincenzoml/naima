// The commands the entry point answers itself, before any plugin is loaded:
// init, update, carry, guide, help. Documented like any plugin's command, so
// the reference lists them, and reserved: no plugin command may take one.

import { CARRY_MODES } from "./config.ts"
import { DATA_DIR, DATA_FILE, DIST_BRANCH, TRACKER_DIR } from "./layout.ts"
import type { Command } from "./types.ts"

/** The commands the entry point answers itself, before any plugin is loaded. Documented like any other. */
export const cliCommands: Omit<Command, "run">[] = [
  {
    name: "init",
    says:
      `make this git repository a Naima project: create ${TRACKER_DIR}/ — its README.md, its .gitignore and ${DATA_DIR}/${DATA_FILE}, locked to the source and commit of the Naima that runs it, which must be committed and pushed; print the line that keeps the program out of each host tool configuration it finds (deno.json, tsconfig.json, .prettierignore); nothing outside ${TRACKER_DIR}/ is touched unless --write-excludes is given`,
    usage: "init [--write-excludes]",
    options: [{
      name: "--write-excludes",
      says:
        "also write those lines into the host's own files: deno.json and tsconfig.json when they are plain JSON, .prettierignore; a file with comments is left to be edited by hand",
    }],
    examples: ["init", "init --write-excludes"],
  },
  {
    name: "update",
    says:
      `move the lock to the head of the source's ${DIST_BRANCH} branch — its main, when the source publishes no ${DIST_BRANCH}: fetch it, migrate the data forward if its format moved, and record the new commit, as one change to commit; the only command that asks the source anything`,
    usage: "update [--check | --accept-source]",
    options: [
      { name: "--check", says: `only say whether the source's ${DIST_BRANCH} (or main) has moved past the locked commit; exit 1 when it has` },
      {
        name: "--accept-source",
        says:
          "trust the source naima.json now names, after reviewing why it changed: every other command refuses to run a program from a source it was not aligned from; aligns the program to the locked commit of the new source, and moves nothing else",
      },
    ],
    examples: ["update --check", "update", "update --accept-source"],
  },
  {
    name: "carry",
    says: "switch how the program is carried — a gitignored clone, vendored as committed files, or a git submodule — staging the switch as one change",
    usage: `carry <${CARRY_MODES.join("|")}>`,
    examples: ["carry vendored", "carry clone"],
  },
  {
    name: "guide",
    says:
      "inside a project, first print what its plugins contribute to the guide, such as the project's active rules for agents; then where the running Naima's documentation is: the skill, the docs map, the guide for people, the rules, the pages for agents, the format, installing; read them as files",
    usage: "guide",
    examples: ["guide"],
  },
  {
    name: "help",
    says: "list every command the loaded plugins provide, with its usage",
    usage: "help",
    examples: ["help"],
  },
]

/** The names no plugin command may take: the entry point answers them first. */
export const RESERVED: readonly string[] = cliCommands.map((c) => c.name)
