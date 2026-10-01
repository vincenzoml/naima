import { newRepo, ctxAt, sh } from "./h.ts"
import { join } from "node:path"
// R1: uncommitted claim in another worktree is invisible from the trunk, and to a second worker
{
  const root = newRepo(); const m = ctxAt(root)
  await m.run("new", "bugs", "Alpha"); await m.run("new", "bugs", "Beta")
  sh(root, "add", "-A"); sh(root, "commit", "-q", "-m", "items")
  const w1 = root + "-w1", w2 = root + "-w2"
  sh(root, "worktree", "add", "-q", "-b", "w1", w1); sh(root, "worktree", "add", "-q", "-b", "w2", w2)
  const a = ctxAt(w1); await a.run("claim", "alpha")
  const b = ctxAt(w2); await b.run("claim", "alpha")
  m.out.length = 0; await m.run("claims")
  console.log("R1 w2 claim output:", JSON.stringify(b.out)); console.log("R1 trunk claims:", JSON.stringify(m.out))
}
// R2: a stale copy on the reader's disk overrides the owner's newer branch version
{
  const root = newRepo(); const m = ctxAt(root)
  await m.run("new", "bugs", "Alpha"); await m.run("new", "bugs", "Beta")
  sh(root, "add", "-A"); sh(root, "commit", "-q", "-m", "items")
  const w = root + "-w"; sh(root, "worktree", "add", "-q", "-b", "w", w)
  const a = ctxAt(w); await a.run("claim", "alpha"); sh(w, "add", "-A"); sh(w, "commit", "-q", "-m", "claim alpha")
  sh(root, "merge", "-q", "--ff-only", "w")   // first batch landed, claim file now on trunk
  await a.run("claim", "beta"); sh(w, "add", "-A"); sh(w, "commit", "-q", "-m", "claim beta")  // w keeps working
  m.out.length = 0; await m.run("claims")
  console.log("R2 trunk claims (w committed alpha+beta):", JSON.stringify(m.out))
  // R3: release everything on w, deletion not committed: the trunk copy resurrects the claim
  a.out.length = 0; await a.run("release", "alpha", "beta"); await a.run("claims"); await a.run("release", "alpha"); await a.run("claim", "alpha")
  console.log("R3 w after release:", JSON.stringify(a.out))
  const { readdirSync } = await import("node:fs"); console.log("R3 files in w claims/:", readdirSync(join(w, "naima-tracker/naima-data/claims")))
}
