// Hosts: the machines a long run or a tool install may go to, declared once in
// the long-work plugin's `hosts` option, and reached through one
// non-interactive ssh call per question that runs the host's own Naima
// (specs/long-work-naima-run-wait-run-list, §4; specs/tools-plugin-declares-tools-needs-naima-tools, §7).

import { spawnSync } from "node:child_process"

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

/** What a host's Naima answered one question: its exit status and output, or why ssh could not ask. */
export interface HostAnswer {
  ok: boolean
  out: string
  err: string
  code: number
}

/** Ask the host's Naima `args`, through one ssh call; its answer, or why there is none. */
export function askHost(host: Host, args: string[], timeoutMs = 120_000): HostAnswer {
  const r = spawnSync("ssh", sshArgs(host, args), { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] })
  const err = r.error ? `ssh: ${r.error.message}` : String(r.stderr ?? "").trim()
  return { ok: r.status === 0, out: String(r.stdout ?? ""), err, code: r.status ?? 1 }
}
