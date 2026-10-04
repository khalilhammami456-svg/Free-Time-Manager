# Font shortlist (Fontsource packages; all existed on npm on 2026-10-04, updated 2026-07)

These are **candidates to test with real content**, not decisions. Also check script coverage (Latin-ext, Arabic, etc.) for her language(s) — most handwriting families here are Latin-only.

| Voice | Package | License | Notes |
|---|---|---|---|
| Reading serif | `@fontsource-variable/newsreader` | OFL | Editorial, gentle, optical size axis; 1.2 MB unpacked (subset) |
| Reading serif | `@fontsource-variable/literata` | OFL | Made for long reading; 1.8 MB unpacked |
| Display serif | `@fontsource-variable/fraunces` | OFL | Soft/"wonk" axes → warmth; 1.9 MB unpacked (subset/axes-limit) |
| Display serif | `@fontsource/instrument-serif` | OFL | Condensed display, 144 KB |
| Display serif | `@fontsource/young-serif`, `@fontsource/dm-serif-display` | OFL | Heavier personality |
| Annotation | `@fontsource-variable/caveat` | OFL | Most common handwriting → recognisable; maybe *too* common |
| Annotation | `@fontsource/reenie-beanie`, `shadows-into-light`, `gloria-hallelujah`, `patrick-hand`, `kalam` | OFL | Different pen characters; 66–724 KB |
| Flourish | `@fontsource/homemade-apple` | Apache-2.0 | Cursive signature feel; very short strings only |
| Ephemera | `@fontsource/special-elite` (Apache-2.0), `@fontsource/cutive-mono` (OFL) | | Typewriter "found document" voice |
| ⚠ Huge | `@fontsource/gaegu` (9 MB), `@fontsource/nanum-pen-script` (5 MB) | OFL | CJK coverage; avoid or subset |

Hypotheses to test (render with real sentences, on a phone):
1. Newsreader (body) + Caveat/Reenie Beanie (annotations).
2. Fraunces (headings, soft axis) + Literata (body) + Special Elite (found documents).
3. **Her actual handwriting** for annotations (scan → vector/custom font) + any serif above.

Avoid the AI-typography tells listed in the main doc §11. Self-host, subset, `font-display: swap`, preload one display face only.
