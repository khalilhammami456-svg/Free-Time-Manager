# Dependency-free techniques

> **Verification:** snippets 1 (seeded PRNG), 2 (SVG paper edge + grain), 3 (draw-on) and 6 (`@starting-style`) were run in headless Chromium 1194 — rendered correctly, PRNG deterministic, dash offset reached 0, card reached opacity 1. Snippets 4, 5 and 7 are standard CSS I did **not** run; test them (7 especially, browser support varies).

## 1. Seeded imperfection (stable "hand-placed" feel)
Randomness generated **once from an id**, never per render, so objects sit identically on every visit.
```ts
// tiny deterministic PRNG (mulberry32) seeded from a string id
function seeded(id: string) {
  let h = 1779033703 ^ id.length;
  for (let i = 0; i < id.length; i++) { h = Math.imul(h ^ id.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const r = seeded("memory-042");
const style = { "--rot": `${(r() - .5) * 6}deg`, "--dx": `${(r() - .5) * 10}px` };
// CSS: transform: translateX(var(--dx)) rotate(var(--rot));
```

## 2. Paper grain & rough edge with an SVG filter (no image assets)
```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="paper-edge" x="-2%" y="-2%" width="104%" height="104%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3"/>   <!-- wobbly edge -->
  </filter>
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0"/>
  </filter>
</svg>
<style>
  .sheet { filter: url(#paper-edge); }
  .grain::after { content:""; position:absolute; inset:0; pointer-events:none; opacity:.08;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>"); }
  .photo { mix-blend-mode: multiply; }   /* print-on-paper feel */
</style>
```
Cost note: SVG filters on large, animated elements are expensive on phones — apply to static layers or small elements, check CPU throttled.

## 3. Draw-on handwriting (real text stays in DOM)
```html
<h2 class="draw" aria-label="Hello you">
  <svg viewBox="0 0 300 80" aria-hidden="true"><path id="w" d="M10 50 C 40 0, 60 90, 90 40 S 150 10, 180 50 S 250 80, 290 30"
       pathLength="1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
</h2>
<style>
  #w { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.4s var(--ease-tender, ease-in-out) forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) { #w { animation: none; stroke-dashoffset: 0; } }
</style>
```
Source paths: trace real handwriting (vector trace of a scan) — outline fonts don't have stroke centrelines, so single-line "draw-on" needs centreline paths (or a mask reveal over the filled glyph). `pathLength="1"` normalises the dash maths.

## 4. Touch-safe hover
```css
@media (hover: hover) and (pointer: fine) { .note:hover { transform: translateY(-3px) rotate(var(--rot)); } }
.note:active { transform: scale(.97); }
```

## 5. Reduced motion = crossfade
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; scroll-behavior: auto !important; }
  .reveal { transition: opacity 200ms linear; transform: none !important; }
}
```
(Blanket `animation-duration` hack is a *floor*; design the reduced version of each set-piece deliberately.)

## 6. Native entrance without JS
```css
.card { transition: opacity .3s var(--ease-out), transform .3s var(--ease-out); }
@starting-style { .card { opacity: 0; transform: translateY(8px) scale(.97); } }
```

## 7. Scroll-linked reveal without JS (progressive enhancement)
```css
@supports (animation-timeline: view()) {
  .reveal { animation: rise linear both; animation-timeline: view(); animation-range: entry 0% entry 60%; }
  @keyframes rise { from { opacity:0; clip-path: inset(0 0 100% 0); } to { opacity:1; clip-path: inset(0); } }
}
```
Firefox support status must be re-checked at build time; the page must be fully usable without it.
