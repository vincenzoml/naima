// The object every command, check and view receives.

import { posixRelative } from "./config.ts"
import { deepFreeze } from "./collections.ts"
import { writes } from "./item.ts"
import { loadRepo } from "./repo.ts"
import type { Config, Context, Registry, Repo } from "./types.ts"

export interface IO {
  out(line?: string): void
  err(line: string): void
  now(): Date
}

export const consoleIO: IO = {
  out: (line = "") => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
  now: () => new Date(),
}

/** Where a project is: its root, its data directory, and the program that runs it. All absolute. */
export interface Place {
  root: string
  data: string
  program: string
}

export function createContext(place: Place, config: Config, registry: Registry, io: IO = consoleIO): Context {
  const trackerRoot = place.data
  let repo: Repo | null = null
  let readAt = -1
  return {
    root: place.root,
    trackerRoot,
    trackerDir: posixRelative(place.root, trackerRoot),
    program: place.program,
    config: deepFreeze(config),
    registry,
    get repo() {
      // Every write through the core's helpers moves `writes()`: the next read sees it.
      if (repo === null || readAt !== writes()) {
        readAt = writes()
        repo = loadRepo(trackerRoot, registry)
      }
      return repo
    },
    reload() {
      repo = null
    },
    out: io.out,
    err: io.err,
    now: io.now,
  }
}
