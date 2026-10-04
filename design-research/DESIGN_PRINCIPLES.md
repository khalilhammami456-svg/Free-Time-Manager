# Design principles (working checklist)

Full reasoning: `../DESIGN_SKILL_RESEARCH.md` §8–§15.

**Feel:** lived-in, warm, playful, tender, slightly magical. "Someone noticed that."
**Engine:** specific attention (her content, your handwriting, real artefacts) — not decoration.

## Before designing a screen
- [ ] One-of-one test: would this survive swapping the names? If yes → redo it.
- [ ] Delight thesis in one sentence: what should she feel, and why does it belong to *her*?
- [ ] Which Norman level is this screen serving — visceral / behavioral / reflective?
- [ ] Is it a rare moment (may be theatrical) or a repeated one (must be instant)?

## Before adding an effect
- [ ] Platform first (CSS/SVG/WAAPI) → one library → second library only for a named set-piece.
- [ ] Is it user-triggered? (Ambient motion needs a reason; pauses when hidden.)
- [ ] Touch equivalent for any hover? Keyboard/tap fallback for any drag?
- [ ] Reduced-motion version = crossfade, same information.
- [ ] Only `transform`/`opacity`; interruptible; <300 ms for repeated UI; 600–1000 ms only for tender reveals.

## Look
- Palette from her real things (photograph the paper, the cover, the ink). Avoid the AI "analog" uniform: cream + high-contrast serif + terracotta + grain + caps eyebrows.
- 2–3 type voices: reading serif · short handwriting annotations · optional typewriter. Real text in DOM.
- Imperfection is seeded & stable (stored per object), never re-randomised on render.
- Spend boldness in one place; remove one accessory.

## Ship gates
- [ ] Tested on a real phone (CPU-throttled), portrait + landscape.
- [ ] Contrast ≥ 4.5:1 body text over texture; ≥ 3:1 focus ring (styled, visible).
- [ ] Sound opt-in; no autoplay; mute obvious.
- [ ] Private hosting, `noindex`, no trackers, no private photos in a public repo.
