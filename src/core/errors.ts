// How Naima fails: a refusal the user can act on, or a bug; and the exit
// code each one ends in (docs/plugin-contract.md#exit-codes).

/** The exit codes of `naima`. A command returns OK or FAILED; the entry point adds the rest. */
export const EXIT = {
  /** Done, and whatever was checked holds. */
  OK: 0,
  /** Done, and what was checked does not hold (a check, a gate, a verdict). */
  FAILED: 1,
  /** Refused: bad usage, or a state the user must change first; the message says which. */
  USAGE: 2,
  /** A bug in Naima or a plugin: the message names it, NAIMA_DEBUG=1 prints its stack. */
  INTERNAL: 70,
  /** The program asks the launcher to run it again (layout.ts's RELAUNCH); never a command's own. */
  RELAUNCH: 75,
} as const

/** A refusal with a machine-readable `code`: what Naima and plugins throw when the user must do something. */
export class NaimaError extends Error {
  readonly code: string
  constructor(message: string, code = "refused") {
    super(message)
    this.name = "NaimaError"
    this.code = code
  }
}

/** The message of anything thrown: an Error's, or the value itself as text. */
export const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Is this a bug rather than a refusal? The engine's own errors (a TypeError
 * from reading a property of undefined, a RangeError, …) and anything thrown
 * that is not an Error; a plain Error or a NaimaError is a refusal Naima
 * wrote on purpose.
 */
export function isInternal(e: unknown): boolean {
  return !(e instanceof Error) || e instanceof TypeError || e instanceof RangeError || e instanceof ReferenceError || e instanceof SyntaxError ||
    e instanceof EvalError || e instanceof URIError
}
