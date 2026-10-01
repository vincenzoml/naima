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
