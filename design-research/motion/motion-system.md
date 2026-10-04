# Motion system — starter tokens (hypotheses to tune on a real phone)

Derived from the installed skills: LottieFiles `motion-design` (personality, emotion mapping, material table) and Emil Kowalski (ease-out entrances, <300 ms repeated UI, interruptibility). **Not final** — the concept decides.

## Personality: "Playful-gentle"
Touch = quick springs with a little overshoot. Reveals/scene changes = tender, slow, soft.

```css
:root {
  /* signature easing (80% of uses): strong ease-out */
  --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
  --ease-inout:  cubic-bezier(0.77, 0, 0.175, 1);   /* on-screen movement */
  --ease-tender: cubic-bezier(0.4, 0, 0.2, 1);      /* slow reveals, ambient */
  --ease-settle: cubic-bezier(0.175, 0.885, 0.32, 1.1); /* ~3-5% overshoot: "paper" landing */

  --t-quick:    150ms;  /* press, toggles */
  --t-standard: 300ms;  /* cards, popovers, small moves */
  --t-slow:     700ms;  /* tender reveals, scene shifts */
}
@media (prefers-reduced-motion: reduce) {
  :root { --t-quick: 1ms; --t-standard: 120ms; --t-slow: 200ms; } /* crossfade-length, not zero */
}
```
(Easing curves are the ones in Emil's `review-animations/STANDARDS.md` and the motion-design skill; verify with easing.dev when tuning.)

## Emotion → motion (from `motion-design/director/emotion-mapping.md`)
| Feeling | Character | Easing | Duration |
|---|---|---|---|
| Tenderness | soft, very subtle curves | soft ease-in-out | 600–1000 ms |
| Joy / delight | bouncy arcs, overshoot, upward | ease-out-back | 200–400 ms |
| Curiosity | exploratory, varied paths | varied | 300–500 ms |
| Calm | smooth, flowing | sine in-out | 500–1000 ms |
| Surprise | sudden, radial outward | ease-out-expo | 150–300 ms |
| Playfulness | irregular, squiggly arcs | ease-out-back | 200–350 ms |

## Material table (paper ≈ 1.0× duration, 3–5% overshoot; fluid/ink 1.5×, ~5%; gas/dust 2×, 0%)

## Rules
1. Never `ease-in` on UI. Never `scale(0)` — start at 0.92–0.97 + opacity 0.
2. Enter ≈ 30–50% longer than exit. Distance scales duration (100 px base, 400 px ≈ 1.6×).
3. Press: `scale(.97)` ≤160 ms; release springs. Hover: <100 ms and only under `(hover:hover)`.
4. Three layers: primary / secondary (lag, settle) / ambient (very low, pauses when hidden).
5. Stagger 30–80 ms per item, cap total at ~400 ms.
6. Shared-element transitions (thumbnail → memory) over fades whenever there is a spatial relationship.
