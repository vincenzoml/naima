# The horizontal site logo and palette look right to the owner, dark and light, desktop and phone

Run by a human because how it looks is the owner's call.

## The gesture

1. On the branch that holds the change, build and serve the site:
   `deno run -A scripts/site.ts /tmp/naima-site && python3 -m http.server 8765 --directory /tmp/naima-site`,
   and open http://127.0.0.1:8765/ (or the published site, once merged).
2. Reload a few times, at desktop width and at phone width, in dark and in light.
3. Must appear: the branch chip `main` (its `ai` lit), its letters travelling into `NAIM` with `AI` accented,
   then the last `A` fading in together with the rest of the page, in about 2 s, then stillness; the tagline
   with `main` as a branch chip and a short passage saying what Naima is; the install line; the one-line agent
   prompt `Please install https://vincenzoml.github.io/naima/ in this repository.`; Documentation and Star on
   GitHub buttons.
   Documentation opens the rendered docs; their nav and links work.
4. The negative half: with reduced motion on, the logo is there at once; at phone width no horizontal scroll.

Pass: the owner says it looks right. Fail: what looks wrong, in their words.

## Measured by the agent so far (not the verdict)

Headless Chrome through the DevTools protocol, frames in the session scratchpad (`site-horizontal/`):
desktop 1280×900 light and dark, phone 390×844, mid-flight frames, three docs pages. Scroll width equals the
viewport at 1280 and 390 on the home page and the docs pages.
