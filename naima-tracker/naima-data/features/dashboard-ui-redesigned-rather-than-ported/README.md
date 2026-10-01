# Dashboard UI, redesigned rather than ported

A window onto the same derived state the CLI prints: boards, gates, the
ranked queue, claims and session notes across branches, and the evidence
attached to each item.

It is designed from the plugin contract, not ported from any earlier
dashboard. What it must respect:

- It reads through the core's public API, like any plugin, and stores nothing:
  every view is derived at read time, exactly as `naima board` is.
- Plugins contribute its panels the way they contribute CLI views today, so a
  new plugin appears without the dashboard knowing it.
- The terminal and the window cannot disagree: same registry, same ranking.

- [ ] decide the delivery (local server, static export, or both)
- [ ] extend the contract with UI contributions, or render existing `views`
- [ ] first screen: summary, gates, next up

## Notes

### 2026-10-01 — Vincenzo Ciancia, on claude/f-u9-dashboard

First screen landed: naima ui opens on Home, three panels — summary (ui plugin, same summarySections as naima summary), gates (gates plugin, same gateRows as naima gates, which gained --json), next up (triage plugin, same nextRows as naima view next). Metrics, timeline, coverage stay tabs. Each panel's /data/<name> equals the command's --json for the same tree, proven by tests/naima-ui-s-first-screen-shows-summary. Look and feel left to the owner: tests/naima-ui-s-first-screen-looks-right (runBy human). Still open on this item: boards, claims and notes across branches, evidence per item. Gates green: deno task verify, node --test, bun test --timeout 30000.
