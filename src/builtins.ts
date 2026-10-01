// The first-party plugins, in load order. Each is loaded with the defaults it
// infers from the repository, unless the project's `plugins` table gives it
// options, switches it off or replaces it. This file and cli.ts are the
// composition root: the only modules that see both the core and the plugins.

import { apiFor, type FirstParty, type Plugin, type PluginOptions } from "./core/internal.ts"
import betaMarkers from "./plugins/beta-markers/index.ts"
import docs from "./plugins/docs/index.ts"
import coordination from "./plugins/coordination/index.ts"
import gates from "./plugins/gates/index.ts"
import trackers from "./plugins/trackers/index.ts"
import triage from "./plugins/triage/index.ts"
import verifier from "./plugins/verifier/index.ts"

/** Every first-party plugin: its name, and the factory that makes it from its options. */
export const firstParty: readonly FirstParty[] = [
  { name: "trackers", factory: trackers },
  { name: "coordination", factory: coordination },
  { name: "triage", factory: triage },
  { name: "gates", factory: gates },
  { name: "beta-markers", factory: betaMarkers },
  { name: "verifier", factory: verifier },
  { name: "docs", factory: docs },
]

/** Every first-party plugin's manifest, each made with its options in `options` (by plugin name) or none: for tests, which load them without a naima.json. */
export const firstPartyPlugins = (options: Record<string, PluginOptions> = {}): Plugin[] =>
  firstParty.map((p) => p.factory(options[p.name] ?? {}, apiFor(p.name, { rename: {} })))
