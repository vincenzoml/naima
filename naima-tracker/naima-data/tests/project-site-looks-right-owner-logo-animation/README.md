# The project site looks right to the owner: the logo animation, dark and light, desktop and phone

## The gesture

1. On the branch that holds `site/`, serve it: `python3 -m http.server 8765 --directory site`,
   and open http://127.0.0.1:8765/ (or the published site, once Pages is on).
2. Reload a few times, at desktop width and at phone width (a phone, or the
   browser's device mode), in dark and in light.
3. Must appear: the branch chip `main` (its `ai` lit), a second `a` dropping in
   (`maain`), the letters travelling into `N` / `AI` / `MA` in about 2–3 s,
   then stillness; the tagline with `main` as a branch chip; one install line
   for the OS (switchable to the other two); the 5-line agent prompt; copy
   buttons that copy. Nothing else on the page.
4. The negative half: with reduced motion on (macOS: Accessibility → Display →
   Reduce motion), the logo is there at once, with no animation; at phone
   width there is no horizontal scroll.

Pass: the owner says it looks right. Fail: what looks wrong, in their words.

## Measured by the agent so far (not the verdict)

Headless Chrome through the DevTools protocol, frames saved in the session
scratchpad (`pages/final/`): desktop 1280×860 and phone 390×844, mid-flight and
final, dark and light, and reduced motion. At 390 px the page's scroll width
is 390 (no horizontal scroll). In headless Chrome the animation sometimes
stalls for lack of frames; the page ends on the logo anyway after 6 s.

## Notes

### 2026-10-01 — triage agent, on claude/effort-triage

Read the item: a single owner visual-judgement gesture on the already-built site, same shape as the other site look-right test.
