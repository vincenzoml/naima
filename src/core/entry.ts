// The commands the entry point answers itself, before any plugin is loaded:
// init, update, plugin, guide, help. Documented like any plugin's command, so
// the reference lists them, and reserved: no plugin command may take one.

import { DATA_DIR, DATA_FILE, PROGRAM_DIR, TRACKER_DIR } from "./layout.ts"
import type { Command } from "./types.ts"

/** The commands the entry point answers itself, before any plugin is loaded. Documented like any other. */
export const cliCommands: Omit<Command, "run">[] = [
  {
    name: "init",
    says:
      `make the git repository around the program a Naima project, as its first run does by itself: beside the program, a git clone of Naima at ${TRACKER_DIR}/${PROGRAM_DIR}/, create ${DATA_DIR}/${DATA_FILE}, locked to the clone's origin and its HEAD, which must be on the origin's main, and the tracker folder's README.md and .gitignore; print the line that keeps the program out of each host tool configuration it finds (deno.json, tsconfig.json, .prettierignore), and the one line that tells agents where Naima is; nothing outside ${TRACKER_DIR}/ is touched unless --write-excludes or --write-agent-pointer is given`,
    enforces:
      "the program is locked to a commit of its source's main, with nothing uncommitted, and nothing outside the tracker folder is written unless --write-excludes or --write-agent-pointer asks",
    usage: "init [--write-excludes] [--write-agent-pointer]",
    options: [
      {
        name: "--write-excludes",
        says:
          "also write those lines into the host's own files: deno.json and tsconfig.json when they are plain JSON, .prettierignore; a file with comments is left to be edited by hand",
      },
      {
        name: "--write-agent-pointer",
        says:
          "also write the line telling agents where Naima is into the host's AGENTS.md, else its CLAUDE.md, else a new AGENTS.md, unless one of its entry files has it",
      },
    ],
    examples: ["init", "init --write-excludes", "init --write-agent-pointer"],
  },
  {
    name: "update",
    says:
      `move the lock to the head of the source's main: fetch it into the program, check it out, migrate the data forward if its format moved, and record the new commit, as one change to commit; the only command that asks the source anything`,
    enforces:
      "the lock moves only to the head of the source's main, with the data migrated forward in the same change; a source naima.json names other than the program's origin is refused, by every command, until --accept-source",
    usage: "update [--check | --accept-source]",
    options: [
      { name: "--check", says: "only say whether the source's main has moved past the locked commit; exit 1 when it has" },
      {
        name: "--accept-source",
        says:
          "trust the source naima.json now names, after reviewing why it changed: every other command refuses to run a program from a source other than its origin; points the program's origin at the new source, checks out the locked commit, and moves nothing else",
      },
    ],
    examples: ["update --check", "update", "update --accept-source"],
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
