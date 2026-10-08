// Hosts and remote runs: a remote run is a run of the host's own Naima,
// reached through one non-interactive ssh call per question
// (specs/long-work-naima-run-wait-run-list, §4).

/** A declared host: where ssh reaches it, the project's checkout there, and the command that runs its Naima from that checkout. */
export interface Host {
  name: string
  ssh: string
  dir: string
  naima: string
}

export const DEFAULT_REMOTE_NAIMA = "deno run -A naima-tracker/naima/naima.ts"
const HOST_NAME = /^[a-z0-9][a-z0-9-]*$/

/** The hosts `options.hosts` declares: name → { ssh, dir, naima? }. */
export function readHosts(options: Record<string, unknown>): Map<string, Host> {
  const raw = options["hosts"] ?? {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('long-work: option hosts must be an object: host name → { "ssh": "<destination>", "dir": "<project on the host>", "naima": "<command>" }')
  }
  const out = new Map<string, Host>()
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!HOST_NAME.test(name)) throw new Error(`long-work: host "${name}" must be named with lowercase letters, digits and dashes`)
    const h = (v && typeof v === "object" ? v : {}) as Partial<Host>
    if (typeof h.ssh !== "string" || !h.ssh.trim() || h.ssh.startsWith("-")) {
      throw new Error(`long-work: host "${name}" needs "ssh", the destination ssh is given (user@machine, or an alias), not starting with "-"`)
    }
    if (typeof h.dir !== "string" || !h.dir.trim()) throw new Error(`long-work: host "${name}" needs "dir", the project's checkout on the host`)
    if (h.naima !== undefined && (typeof h.naima !== "string" || !h.naima.trim())) {
      throw new Error(`long-work: host "${name}": "naima" must be the command that runs Naima there, from dir`)
    }
    out.set(name, { name, ssh: h.ssh, dir: h.dir, naima: h.naima ?? DEFAULT_REMOTE_NAIMA })
  }
  return out
}

/** One word for a POSIX shell, quoted only when it must be. */
export function shellQuote(word: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`
}

/** The arguments of the one ssh call that runs `naima <args>` in the host's checkout. */
export function sshArgs(host: Host, args: string[]): string[] {
  const remote = `cd ${shellQuote(host.dir)} && ${host.naima} ${args.map(shellQuote).join(" ")}`
  return ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", host.ssh, remote]
}
