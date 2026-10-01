// The plugin API: everything a plugin may use of the core, and nothing else.
// A plugin inside the program imports it from this file; any plugin — one a
// project pins from outside the program too — receives the same functions as
// the second argument of its factory, with its own scope, and so needs no
// import at all. Everything the entry point, the loader and the tests use
// besides is in ./internal.ts, which no plugin may import: test/arch.test.ts holds it.

export type * from "./types.ts"
import type * as Api from "./api.ts"
import type { PluginScope } from "./types.ts"

/** What a plugin's factory receives as its second argument: this whole API, with the plugin's own scope. */
export type PluginApi = Omit<typeof Api, "CONTRACT" | "OLDEST_CONTRACT"> & PluginScope & { readonly contract: number }

export { CONTRACT, OLDEST_CONTRACT } from "./contract.ts"

export { bool, type Flags, pairs, parse, type Parsed, positiveInt, str, strs, usageError } from "./args.ts"
export { appliesTo, enumRank, fieldError, type FieldRef, fieldsOf, fieldValue, fieldValues, parseFieldValue, setFieldValue, type ValueOf } from "./fields.ts"
export {
  ATTACHMENTS,
  createItem,
  isUuid,
  joinProse,
  listDirs,
  META,
  moveItem,
  NOTES_HEADING,
  README,
  readReadme,
  saveMeta,
  saveProse,
  slugify,
  splitProse,
  today,
  uniqueSlug,
  writeJson,
  type WriteOptions,
} from "./item.ts"
export { storedLinks } from "./repo.ts"
export { groupBy } from "./collections.ts"
export { EXIT, isInternal, message, NaimaError } from "./errors.ts"
export { isRegularFile, NEVER_SOURCE, walkFiles, writeFileAtomic } from "./files.ts"
export { byUrgency, hasFlag, hasTrait, isEvidenceType, isOpen, label, linked, proves, refutes, statusDef, urgency } from "./lifecycle.ts"
export { flagsOf } from "./vocabulary.ts"
export { addLink, alongside, renderBoard, setFields, typeOrThrow } from "./base.ts"
export { type CheckReport, runChecks } from "./check.ts"
export {
  type AcrossOptions,
  allRefNames,
  type BranchFile,
  currentBranch,
  filesAt,
  gitOrNull,
  gitPath,
  gitReason,
  type GitRun,
  isGitRepo,
  mustGit,
  projectFiles,
  readAcrossBranches,
  refsWorthReading,
  runGit,
  toplevel,
  trunk,
  type Worktree,
  worktrees,
} from "./git.ts"
export { DATA_FILE, DEFAULT_DATA, TRACKER_DIR } from "./layout.ts"
export { cell, code, sentence, table } from "./markdown.ts"
export { commandGaps, commandSection, FIELD_KINDS, optionsTable } from "./points.ts"
export { contributionsOf } from "./manifest.ts"
export { shortOrId } from "./names.ts"
export { cliCommands } from "./entry.ts"
export { asRendered, type Format, FORMATS, linesAs, rendered } from "./rendered.ts"
