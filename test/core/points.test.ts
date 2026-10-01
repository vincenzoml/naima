// Extension points: a plugin declares a new kind of contribution as data,
// and any plugin contributes to it — with nothing in the core edited. The
// core's own kinds are points declared the same way.

import assert from "node:assert/strict"
import { test } from "node:test"
import { buildRegistry, type Context, CORE_POINTS, type ExtensionPoint, type Plugin } from "../../naima/src/core/internal.ts"
import { corePlugin } from "../../naima/src/core/base.ts"
import { tempProject } from "./testing.ts"

/** A notifier: what a third-party plugin wants other plugins to be able to contribute. */
interface Notifier {
  name: string
  says: string
  notify(message: string, ctx: Context): string
}

const notifiersPoint: ExtensionPoint<Notifier> = {
  id: "notifiers",
  says: "somewhere to send a message: `notify(message, ctx)`",
  noun: "notifier",
  key: (n) => n.name,
  renamed: (n, name) => ({ ...n, name }),
  validate: (v) => (typeof (v as Notifier)?.notify === "function" ? null : "has no notify function"),
  gaps: (n) => (n.says ? [] : ["does not say where it sends"]),
  document: (ns) => ns.map((n) => `- ${n.name}: ${n.says}`),
}

/** Declares the point, and a command that uses every contribution to it, whoever made it. */
const notify: Plugin = {
  name: "notify",
  says: "sends messages through every notifier",
  points: [notifiersPoint],
  commands: [{
    name: "notify",
    says: "send a message through every notifier",
    usage: "notify <message>",
    examples: ["notify hello"],
    run(args, ctx) {
      for (const c of ctx.registry.contributions("notifiers")) ctx.out((c.value as Notifier).notify(args.join(" "), ctx))
      return 0
    },
  }],
}

/** Another plugin, contributing to a point it did not declare. */
const chat: Plugin = {
  name: "chat",
  says: "a chat room",
  contributes: { notifiers: [{ name: "room", says: "the team's room", notify: (m: string) => `room: ${m}` } satisfies Notifier] },
}

test("the core's kinds are extension points like any other", () => {
  const r = buildRegistry([corePlugin])
  assert.deepEqual([...r.points.keys()], CORE_POINTS.map((p) => p.id))
  assert.ok(r.points.has("types") && r.points.has("commands") && r.points.has("migrations"))
  assert.ok(!r.points.has("gates") && !r.points.has("verifiers"), "gates and verifiers are plugins' points, not the core's")
})

test("a plugin declares a new extension point, another contributes to it, and a command uses it — without editing the core", async () => {
  const p = tempProject([notify, chat, {
    name: "mail",
    says: "mail",
    contributes: { notifiers: [{ name: "mail", says: "the list", notify: (m: string) => `mail: ${m}` }] },
  }])
  try {
    const r = p.ctx.registry
    assert.equal(r.points.get("notifiers"), notifiersPoint)
    assert.deepEqual(r.contributions("notifiers").map((c) => c.id), ["chat/room", "mail/mail"])
    assert.equal(r.find<Notifier>("notifiers", "room")?.value.says, "the team's room")
    await p.run("notify", "the", "build", "is", "green")
    assert.deepEqual(p.output, ["room: the build is green", "mail: the build is green"])
  } finally {
    p.cleanup()
  }
})

test("a point validates what is contributed to it, and names are qualified and renamed as the core's are", () => {
  assert.throws(
    () => buildRegistry([corePlugin, notify, { name: "bad", says: "", contributes: { notifiers: [{ name: "x", says: "" }] } }]),
    /plugin "bad": a notifier it contributes has no notify function/,
  )
  const twin: Plugin = { name: "twin", says: "", contributes: { notifiers: [{ name: "room", says: "another room", notify: () => "" }] } }
  const r = buildRegistry([corePlugin, notify, chat, twin])
  assert.throws(() => r.find("notifiers", "room"), /notifier "room" is ambiguous: chat\/room, twin\/room/)
  const renamed = buildRegistry([corePlugin, notify, chat, twin], { rename: { notifiers: { "twin/room": "hall" } } })
  assert.equal(renamed.find<Notifier>("notifiers", "hall")?.value.says, "another room")
})

test("a contribution to a point no loaded plugin declares is refused, unless the plugin says the point is optional", () => {
  assert.throws(() => buildRegistry([corePlugin, chat]), /plugin "chat" contributes to "notifiers", which no loaded plugin declares as an extension point/)
  assert.equal(buildRegistry([corePlugin, { ...chat, optional: ["notifiers"] }]).contributions("notifiers").length, 0, "dropped, not refused")
  assert.throws(() => buildRegistry([corePlugin, { name: "typo", says: "", comands: [] } as unknown as Plugin]), /contributes to "comands"/)
})

test("a point is declared once, and never under a manifest key's name", () => {
  assert.throws(
    () => buildRegistry([corePlugin, notify, { ...notify, name: "again", commands: [] }]),
    /extension point "notifiers" is declared by both "notify" and "again"/,
  )
  assert.throws(
    () => buildRegistry([corePlugin, { name: "x", says: "", points: [{ ...notifiersPoint, id: "types" }] }]),
    /extension point "types" is declared by both "core" and "x"/,
  )
  assert.throws(() => buildRegistry([corePlugin, { name: "x", says: "", points: [{ ...notifiersPoint, id: "options" }] }]), /"options" is a manifest key/)
})
