// A second worked example of a non-software item-type pack, alongside
// `pack-analyses`: a paper's own practice (sections written to an agreed
// outline, and a co-author's review of one) swapped in for software's
// practice (code, reviewed and tested). Two types, reusing the generic proof
// machinery (`verifies`/`verified-by`) rather than inventing a parallel one:
// a review plays the role a test plays for code.
//
// Opt in with `plugins.pack-papers: {}` in naima.json; none of this exists
// until a project asks for it.

import {
  type Check,
  type Context,
  CONTRACT,
  type FieldDef,
  type Finding,
  type Item,
  label,
  linked,
  type Plugin,
  proves,
  refutes,
  type TypeDef,
} from "../../core/api.ts"

const sectionsType: TypeDef = {
  id: "sections",
  dir: "sections",
  title: "Sections",
  says:
    "a section of the paper: proven, like a requirement, by a review of it — a co-author's review, linked verified-by, whose status proves (every objection answered: matches the outline) or refutes (an objection stands) it",
  statuses: {
    proposed: { category: "open", says: "drafted, not yet checked against the outline" },
    confirmed: { category: "done", says: "a review's objections are all answered: the text matches what the outline agreed" },
    disputed: { category: "done", says: "a review found an objection that still stands: reword, then reopen the review" },
    dropped: { category: "done", says: "no longer in the outline; the page says why" },
  },
  initialStatus: "proposed",
  template: (title) =>
    `# ${title}\n\nThis section's place in the outline, and what it must cover.\n\n## Text\n\nThe section's own prose — written here, or linked to its \`.tex\` file in the paper repository.\n`,
}

const reviewsType: TypeDef = {
  id: "reviews",
  dir: "reviews",
  title: "Reviews",
  says: "a co-author's review of one section: proven not by running anything, but by the reviewer's own objections being answered",
  statuses: {
    open: { category: "open", says: "objections raised, not yet answered" },
    answered: { category: "done", proves: true, says: "every objection this review raised is answered" },
    standing: { category: "done", refutes: true, says: "at least one objection stands, unanswered: the reviewer says it does not match the outline" },
    withdrawn: { category: "done", says: "no longer applies; the page says why" },
  },
  initialStatus: "open",
  template: (title) =>
    `# ${title}\n\nThe reviewer, and the section reviewed.\n\n## Objections\n\n- [ ] \n\nEach objection answered, or stands: say which, and how it was addressed.\n`,
}

const REVIEWER: FieldDef = {
  name: "reviewer",
  kind: "string",
  says: "the co-author who wrote this review",
  appliesTo: ["reviews"],
}

const isSection = (i: Item): boolean => i.type === sectionsType.id

const sectionsOf = (ctx: Context): Item[] => ctx.repo.items.filter(isSection)

/** The reviews that prove or refute a section: those linked `verified-by`. */
const reviewsOf = (ctx: Context, s: Item): Item[] => linked(ctx, s, "verified-by")

const sectionsCheck: Check = {
  name: "sections-reviewed",
  says:
    "a section marked confirmed has a review verifying it that answered every objection, and none still standing; one reviewed but still proposed, or disputed but still proposed, is noted",
  run(ctx) {
    const out: Finding[] = []
    for (const s of sectionsOf(ctx)) {
      const reviews = reviewsOf(ctx, s)
      const refuted = reviews.some((r) => refutes(ctx, r))
      const proven = reviews.some((r) => proves(ctx, r))
      const status = s.meta.status
      if (status === "confirmed" && refuted) {
        out.push({
          level: "problem",
          item: s,
          message: `${label(s)} is confirmed, but ${
            reviews.filter((r) => refutes(ctx, r)).map(label).join(", ")
          } stands with an unanswered objection — naima set ${label(s)} status=disputed`,
        })
      } else if (status === "confirmed" && !proven) {
        out.push({
          level: "problem",
          item: s,
          message: `${label(s)} is confirmed, but no review has answered its objections — naima new reviews "<co-author> reviews ${
            label(s)
          }", naima link it verifies ${label(s)}`,
        })
      } else if (status === "proposed" && refuted) {
        out.push({ level: "note", item: s, message: `${label(s)} is disputed by a review that still stands — naima set ${label(s)} status=disputed` })
      } else if (status === "proposed" && proven) {
        out.push({ level: "note", item: s, message: `${label(s)} matches the outline — naima set ${label(s)} status=confirmed` })
      }
    }
    return out
  },
}

export default function packPapers(): Plugin {
  return {
    name: "pack-papers",
    contract: CONTRACT,
    says: "a second worked example of a non-software item-type pack: a paper's sections, proven by a co-author's review rather than by a test",
    about: "The same discipline `pack-analyses` applies to a data-analysis step applies here to a paper. " +
      "A **section** is one part of the paper, written to an agreed outline. A **review** is a co-author's pass over one section: " +
      "it raises objections, and is linked `verifies` the section, the same relation a test uses on a requirement. " +
      "A review's status `proves` the section (every objection answered: the text matches the outline) or `refutes` it (an objection still stands) — " +
      "proof that comes from the reviewer reading the prose, never from running anything. " +
      "`naima check` notes a section confirmed without an answering review, or reviewed but still proposed — the same shape pack-analyses uses for code-free work. " +
      "This is the second worked example named by `features/non-software-item-type-packs-experiments-analyses`; a third kind of non-software work is its own pack, following the same pattern.",
    types: [sectionsType, reviewsType],
    fields: [REVIEWER],
    // What it reads of the trackers plugin: the relation a review verifies a section by.
    uses: { relations: ["verified-by"] },
    checks: [sectionsCheck],
  }
}
