// The first-party plugins, in load order. Each is loaded with the defaults it
// infers from the repository, unless the project's `plugins` table gives it
// options, switches it off or replaces it. This file and cli.ts are the
// composition root: the only modules that see both the core and the plugins.

import { apiFor, type FirstParty, type Plugin, type PluginOptions } from "./core/internal.ts"
import betaMarkers from "./plugins/beta-markers/index.ts"
import docs from "./plugins/docs/index.ts"
import epics from "./plugins/epics/index.ts"
import coordination from "./plugins/coordination/index.ts"
import gates from "./plugins/gates/index.ts"
import loop from "./plugins/loop/index.ts"
import metrics from "./plugins/metrics/index.ts"
import planning from "./plugins/planning/index.ts"
import privacy from "./plugins/privacy/index.ts"
import rules from "./plugins/rules/index.ts"
import trackers from "./plugins/trackers/index.ts"
import triage from "./plugins/triage/index.ts"
import ui from "./plugins/ui/index.ts"
import verifier from "./plugins/verifier/index.ts"

/** Every first-party plugin: its name, and the factory that makes it from its options. */
export const firstParty: readonly FirstParty[] = [
  { name: "trackers", factory: trackers },
  { name: "coordination", factory: coordination },
  { name: "triage", factory: triage },
  { name: "gates", factory: gates },
  { name: "epics", factory: epics },
  { name: "planning", factory: planning },
  { name: "loop", factory: loop },
  { name: "beta-markers", factory: betaMarkers },
  { name: "verifier", factory: verifier },
  { name: "ui", factory: ui },
  { name: "metrics", factory: metrics },
  { name: "rules", factory: rules },
  { name: "privacy", factory: privacy },
  { name: "docs", factory: docs },
]

/** Every first-party plugin's manifest, each made with its options in `options` (by plugin name) or none: for tests, which load them without a naima.json. */
export const firstPartyPlugins = (options: Record<string, PluginOptions> = {}): Plugin[] =>
  firstParty.map((p) => p.factory(options[p.name] ?? {}, apiFor(p.name, { rename: {} })))
