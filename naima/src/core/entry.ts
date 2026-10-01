// The commands the entry point answers itself, before any plugin is loaded:
// init, update, carry, guide, help. Documented like any plugin's command, so
// the reference lists them, and reserved: no plugin command may take one.

import { CARRY_MODES } from "./config.ts"
import { DATA_DIR, DATA_FILE, PROGRAM_DIR, TRACKER_DIR } from "./layout.ts"
import type { Command } from "./types.ts"

/** The commands the entry point answers itself, before any plugin is loaded. Documented like any other. */
export const cliCommands: Omit<Command, "run">[] = [
  {
    name: "init",
    says:
      `make this git repository a Naima project: create ${TRACKER_DIR}/ — its README.md, its .gitignore and ${DATA_DIR}/${DATA_FILE}, locked to the source and commit of the Naima that runs it, which must be committed and pushed, and the copy of that commit's naima/ in ${TRACKER_DIR}/${PROGRAM_DIR}/; print the line that keeps the program out of each host tool configuration it finds (deno.json, tsconfig.json, .prettierignore), and the line that points each agent-harness entry file it finds (CLAUDE.md, AGENTS.md, and the other sensible defaults, or a project's own entryFiles) at Naima's own agent docs; nothing outside ${TRACKER_DIR}/ is touched unless --write-excludes or --write-agent-pointer is given`,
    enforces:
      "the program is locked to a commit of its source that is committed and pushed, and nothing outside the tracker directory is written unless --write-excludes or --write-agent-pointer asks",
    usage: "init [--write-excludes] [--write-agent-pointer]",
    options: [
      {
        name: "--write-excludes",
        says:
          "also write those lines into the host's own files: deno.json and tsconfig.json when they are plain JSON, .prettierignore; a file with comments is left to be edited by hand",
      },
      {
        name: "--write-agent-pointer",
        says: "also write the one-line pointer into each configured entry file that exists and does not already have it",
      },
    ],
    examples: ["init", "init --write-excludes", "init --write-agent-pointer"],
  },
  {
    name: "update",
    says:
      `move the lock to the head of the source's main: fetch it, copy its naima/ into the program, migrate the data forward if its format moved, and record the new commit, as one change to commit; the only command that asks the source anything`,
    enforces:
      "the lock moves only to the head of the source's main, with the data migrated forward in the same change; a source naima.json names other than the one the program was aligned from is refused, by every command, until --accept-source",
    usage: "update [--check | --accept-source]",
    options: [
      { name: "--check", says: "only say whether the source's main has moved past the locked commit; exit 1 when it has" },
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
    says:
      "switch how the program is carried — a gitignored copy of naima/, the same copy committed (vendored), or a git submodule of the whole commit — staging the switch as one change",
    enforces: "nothing: it switches how the program is carried and stages the switch as one change for a person to commit",
    usage: `carry <${CARRY_MODES.join("|")}>`,
    examples: ["carry vendored", "carry copy"],
  },
  {
    name: "plugin",
    says:
      "turn a plugin on or off, or set one of its options, in naima.json's plugins table — validated the way the project is validated on every load, instead of a hand-edit of the file",
    enforces:
      "a name must be a first-party plugin (loaded or opt-in) or one the table already names with its own source; an option set on one whose options are known here must be one it declares; the whole file is re-validated before it is written, so nothing a later load would refuse ever reaches disk",
    usage: "plugin enable <name> | plugin disable <name> | plugin set <name> <option>=<value>... | plugin show [<name>]",
    examples: [
      "plugin enable verifier-mcrl2",
      "plugin set verifier-mcrl2 bin=/usr/local/bin",
      "plugin disable rule-templates",
      "plugin show verifier-mcrl2",
      "plugin show",
    ],
  },
  {
    name: "guide",
    says:
      "inside a project, first print what its plugins contribute to the guide, such as the project's active rules for agents; then where the running Naima's documentation is: the skill, the docs map, the guide for people, the rules, the pages for agents, the format, installing; read them as files",
    enforces: "nothing: it only prints",
    usage: "guide",
    examples: ["guide"],
  },
  {
    name: "help",
    says: "list every command the loaded plugins provide, with its usage",
    enforces: "nothing: it only prints",
    usage: "help",
    examples: ["help"],
  },
]

/** The names no plugin command may take: the entry point answers them first. */
export const RESERVED: readonly string[] = cliCommands.map((c) => c.name)
