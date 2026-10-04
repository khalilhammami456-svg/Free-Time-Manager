# Design Skill Research — for "the notebook"

> Prepared 2026-10-04. Mission: equip the environment to later build a deeply personal digital notebook for one person.
> **Nothing of the app has been built.** This repo (`Free-Time-Manager`) is an unrelated Vite + React 19 + Tailwind 4 planner; I used it only as the host for skills and notes and changed no app code or dependencies.
>
> Companion files: [`design-research/`](design-research/README.md) · installed-skill provenance: [`design-research/skills/INSTALLED.md`](design-research/skills/INSTALLED.md)
>
> **Honesty about method.** Web search worked; direct page fetch was blocked by the sandbox egress proxy for `motion.dev`, `awwwards.com` and `scrollytelling.ai`. GitHub repos were cloned and read in full. npm facts (versions, dates, licenses, sizes) come from the live registry. Download counts were unavailable. Anything I could not open myself is marked **unverified**. Star counts quoted in blogs were not independently verified and I did not use them to pick anything.

---

## 1. Executive summary

* **The ecosystem is rich but redundant.** There are hundreds of "design skills" for Claude Code. Most are the same advice (avoid Inter + purple gradients, pick a direction, check contrast) repackaged, and many bundle scripts, hooks or style databases that add risk without adding taste.
* **Almost none address the emotional brief.** The popular ones target SaaS/landing pages/dashboards — the exact things this project must *not* look like. The useful material is in three places: Impeccable's **Experience mode** and `delight`/`shape` playbooks; LottieFiles' **emotion→motion** mapping; and Emil Kowalski's **restraint rules** (when *not* to animate). Combined they give us direction + feeling + discipline.
* **Installed 12 skills (860 KB of markdown, 0 executables)** from 4 sources, all pinned to reviewed commits: Impeccable (without its binary engine/hooks), LottieFiles motion-design, 4 of Emil Kowalski's, 6 of GreenSock's official GSAP skills.
* **No npm packages installed.** The notebook is a *different project*; installing animation libraries into a student planner would just pollute it. Section 6 gives a verified, tiered library list for when the concept exists.
* **Biggest design risk identified:** the "analog/personal" look is now an AI cliché (cream paper + high-contrast serif + terracotta accent + hearts/handwriting font). The notebook must get its personality from *her specific content and interactions*, not from a themed skin.
* **Biggest practical risks:** (1) she will very likely open it on a phone — hover-based magic must have touch equivalents; (2) it will contain private photos — it needs access control and `noindex`, not just an obscure URL; (3) handwriting fonts are Latin-only — language/script of the content (and RTL if Arabic) must be decided before choosing type.

---

## 2. Best design skills (and why)

| Role in the build | Skill | Why it won |
|---|---|---|
| **Direction & critique** | `impeccable` (Apache-2.0, active — last commit the day of research) | Only skill with a full lifecycle (shape → build → critique → polish → audit) and an *Experience* mode where "the interface recedes". `new-work.md` forces a committed visual world instead of defaults. `shape` = plan before code. Anti-pattern rules directly counter "generic AI website". |
| **Emotional motion** | `motion-design` (LottieFiles, MIT) | Maps feelings to curve/duration/path ("Tenderness: very subtle curves, soft ease-in-out, 600–1000 ms"), one *motion personality* per project, Disney principles, three motion layers (primary/secondary/ambient). Library-agnostic. |
| **Motion craft & restraint** | Emil Kowalski: `emil-design-eng`, `animate`, `review-animations`, `find-animation-opportunities` (MIT) | Concrete correctness rules (ease-out for entrances, never `scale(0)`, interruptible CSS transitions, transform/opacity only, `@starting-style`, reduced motion) and — critically — a **frequency table**: repeated actions get no animation; *rare/first-time moments earn delight*. `find-animation-opportunities` also says what **not** to animate. |
| **Choreography engine knowledge** | GSAP official skills (core, timeline, scrolltrigger, plugins, react, performance) | Prevents hallucinated GSAP APIs; covers `useGSAP` cleanup in React, SplitText/DrawSVG/Draggable/Flip. Official, current (GSAP plugins are now free). |

How they are meant to interlock: **Impeccable decides *what the world is*** → **motion-design decides *what it feels like to move in it*** → **Emil's skills police each animation** → **GSAP skills implement the few choreographed set-pieces**. Overlap is intentional only at the boundaries (Impeccable's `animate`/`delight` vs. the motion skills); on conflict, *the brief wins* (Impeccable's own rule) and then the emotional intent from `motion-design`.

---

## 3. Installed skills (exact)

Location: `.claude/skills/` · Reinstall elsewhere: `design-research/scripts/install-skills.sh <target>`

```
impeccable/                 pbakaus/impeccable @6e802bd      Apache-2.0   (scripts/ + hooks intentionally omitted)
motion-design/              lottiefiles/motion-design-skill @f9a8a04   MIT
emil-design-eng/ animate/ review-animations/ find-animation-opportunities/
                            emilkowalski/skills @e8a175d     MIT
gsap-core/ gsap-timeline/ gsap-scrolltrigger/ gsap-plugins/ gsap-react/ gsap-performance/
                            greensock/gsap-skills @aed9cfd   MIT
```

Security outcome (details in INSTALLED.md): all text-only; no network calls, eval, base64, credential access. **The one thing I refused:** Impeccable's launcher/hook engine (downloads a native binary on first run and executes it on every edit). I stripped it and left a local note in its `SKILL.md`. What you lose: its 61 automated detector rules and live-browser iteration. What you keep: every design playbook.

Usage once building starts (suggested order): `/impeccable shape` → `/impeccable init` (writes `PRODUCT.md`: who she is, what this is for) → build → `/impeccable critique` → `/review-animations` + `/find-animation-opportunities` → `/impeccable audit` → `/impeccable polish`.
**Heads-up:** `init`/`PRODUCT.md` is where *your* knowledge goes; Impeccable's default questions are product-oriented ("audience, purpose, constraints"). For this project answer them as *her*, with specifics.

---

## 4. Rejected / deferred (useful, intentionally not installed)

Full table in INSTALLED.md. Highlights:

* **Anthropic `frontend-design`** — read in full; redundant with Impeccable. Its best lesson is captured in §11 (the AI "analog" cliché list).
* **Official Motion AI Kit** — *couldn't inspect* (domain blocked). Deferred, not rejected; you may install it yourself after reading it. Might involve paid Motion+ features (unverified).
* **Vercel `web-design-guidelines`** — rejected: instructs the agent to fetch and obey a mutable remote file at runtime. I will not wire remote text into the agent as instructions.
* **UI/UX Pro Max** (30 MB, Python), **LibreUIUX** (152 agents), **MengTo/Skills** (156 MB), **mae616** — bloat or generic style-matching; redundant.
* **Three.js / Rive / Lottie agent skills** — not installed because we haven't decided those technologies are needed (see §6). Install on demand.

---

## 5. Research notes by theme

### 5.1 Emotional / experiential design — what the sources agree on
* **Don Norman's three levels** (visceral = first impression, behavioral = usability/flow, reflective = personal meaning & memory). A gift notebook is a **reflective-level product**: its job is meaning. Visceral gets her to open it; behavioral must be effortless (she isn't a designer); reflective is the payoff.
* **Aarron Walter's hierarchy** (functional → reliable → usable → pleasurable): delight sits on top. A beautiful page that stutters, loads slowly on her phone, or loses her place breaks the spell faster than any plain page.
* **Emil Kowalski's frequency rule + Impeccable's "earned delight"**: surprise works because it is rare. Reserve the big moments for rare/first-time discoveries; keep repeated actions (turning a page, opening a note) fast and certain.
* **Impeccable `delight`: write a *delight thesis* — one sentence of what she should feel and why it belongs to *her*** — before adding any flourish. "Generic whimsy is worse than neutral clarity."
* Commercial "digital love letter" generators exist (LoveTale, GiftFeels, Letters by Heart, 2-LUV…). They are the **anti-reference**: envelope-opens + hearts + stock stages. Their existence is why the "made for you" feeling must come from *specific, un-templatable* content.

### 5.2 Analog/scrapbook craft vocabulary (junk-journal & scrapbook practice)
Layered ephemera (tickets, receipts, pressed things), tape, torn/deckled edges, handwritten marginalia, stamps, stitched or glued photos, paper stock changes between pages, intentional imperfection, found-object "collections." Web equivalents: layered `z-index` + soft contact shadows, SVG-filter edges, `mix-blend-mode: multiply` photo-on-paper, seeded (stable) rotation, grain overlays, handwriting that *draws on*.
**Judgement:** use these only where *her* material justifies them (a real ticket stub photographed, her handwriting, your handwriting). A themed skin of fake ephemera is a template.

### 5.3 Micro-interactions — what is worth it
| Technique | Emotional value | Perf | A11y | Mobile | Verdict |
|---|---|---|---|---|---|
| Press feedback (scale 0.97, spring release) | High, constant | Trivial | Fine | ✔ | **Use everywhere** |
| Pointer-reactive tilt / light on cards | Medium | OK (transform) | Needs non-pointer path | ✘ hover; gyro needs iOS permission prompt | Desktop enhancement only |
| Magnetic buttons / custom cursor | Low-medium, *cliché* | OK | Risky (custom cursors hide focus) | ✘ | **Skip** |
| Draggable objects (polaroids, notes) | High (physical, playful) | OK | Must offer keyboard/tap alternative | ✔ w/ pointer events | **Use sparingly, 1–2 set-pieces** |
| Draw-on handwriting (SVG `stroke-dashoffset` / DrawSVG) | **Very high** (human presence) | OK for short text | Real text must exist in DOM | ✔ | **Core technique** (short phrases only) |
| Clip-path image reveals | High | Good | Fine | ✔ | **Use** (Emil: "Image reveals on scroll") |
| Page-turn / fold | High if done well | Hard | Hard | ✔ | **Build custom** (§6); don't use abandoned flipbook libs |
| Scroll parallax / scrolljacking | Low unless storytelling | Mixed | Motion sickness | Janky | Native scroll-driven CSS only; never hijack scroll |
| Sound on interact | High (intimacy) | Light | Opt-in required | iOS needs gesture | **Opt-in, tiny, designed** |
| Confetti / hearts burst | Low, cliché | Fine | — | — | At most once, custom-drawn |

### 5.4 Motion — see §9. Layout/typography/etc. — §10–§13.

---

## 6. Recommended libraries (verified against the npm registry, 2026-10-04)

**Nothing is installed.** Principle: platform first (CSS/SVG/WAAPI), one animation library by default, a second only for a named set-piece. "Core" = likely default; "Situational" = only if the concept needs it.

### Animation
| Package | Version / last publish | License | Verdict |
|---|---|---|---|
| `motion` (Framer Motion's successor) | 14.0.0 · 2026-10-02 | MIT | **Core.** React-idiomatic: springs, gestures/drag, layout & shared-element transitions, `AnimatePresence`. Pair with Emil's skill (hardware-accel caveats). |
| `gsap` (+`@gsap/react`) | 3.15.0 · 2026-04 (react helper 2.1.2, 2025-01) | GSAP "no charge" license (all plugins free) — **read its terms before shipping** | **Situational.** Pick it for timelines/choreographed scenes, SplitText, DrawSVG, Draggable. Installed skills already cover it, so the option stays open. Don't use both for the same job. |
| CSS: `@starting-style`, `linear()` springs, scroll-driven animations, View Transitions | native | — | **Try first.** Scroll-driven animations: Chromium 115+, Safari 26; Firefox support was still in development in early 2026 (**verify at build time**). Cross-document View Transitions: Chrome 126+/Firefox 128+/Safari 18+ per search results. Both respect reduced-motion gating when you write it so. |
| `react-spring` | 10.x · 2026 | MIT | Skip — redundant with Motion. |

### Interaction
* `@use-gesture/react` 10.3.1 (2024-03, MIT, 36 KB) — **Situational.** Motion already has `drag`/`pan`; use-gesture adds pinch/zoom (photos). Quiet repo since 2024.
* `@dnd-kit/*` — already in this repo for planner drag-and-drop; irrelevant to a loose "scatter" layout, relevant only if we need sortable pages.

### Typography
Self-host with **Fontsource** (OFL, all verified on npm, updated 2026-07). Shortlist for *testing*, not decisions:
* **Display/serif voices:** `@fontsource-variable/fraunces` (variable "wonk"/softness axes, 1.9 MB unpacked — subset it), `@fontsource/instrument-serif`, `@fontsource-variable/newsreader`, `@fontsource-variable/literata`, `@fontsource/young-serif`, `@fontsource/dm-serif-display`.
* **Handwriting (use for *annotations*, not body):** `@fontsource-variable/caveat`, `@fontsource/reenie-beanie`, `@fontsource/shadows-into-light`, `@fontsource/gloria-hallelujah`, `@fontsource/homemade-apple` (Apache-2.0, flourishy), `@fontsource/kalam`, `@fontsource/patrick-hand`.
* **Typewriter/"ephemera":** `@fontsource/special-elite`, `@fontsource/cutive-mono`.
* **Warning:** `gaegu` (9 MB) and `nanum-pen-script` (5 MB) are huge (CJK subsets) — subset or avoid.
* **Best option:** *her/your actual handwriting*, scanned and vectorised → real SVG paths (for draw-on) or a custom font. Beats every library above. (Font-from-handwriting services exist; I haven't evaluated one.)
* Text splitting: GSAP SplitText (free) or hand-rolled spans; `split-type` (0.3.4, last release 2023) — avoid.

### Graphics / drawing
* `perfect-freehand` 1.2.3 (2026-02, MIT, 0 deps, 109 KB unpacked) — **Core candidate**: pressure-style strokes from points; lets her *draw on the page with a finger*, or lets us turn recorded strokes into replayable handwriting.
* `roughjs` 4.6.6 (2023) / `rough-notation` 0.5.1 (**2020**, 62 KB, tiny and stable) — hand-drawn underline/circle/bracket annotations. Fine but dormant; the same effect is ~30 lines of SVG + `stroke-dashoffset`, with no dependency and proper reduced-motion handling. **Prefer hand-rolled.**
* **SVG filters** (`feTurbulence`, `feDisplacementMap`) — zero-dependency paper grain, torn/wobbly edges, ink bleed. **Core technique.**
* `@rive-app/react-canvas` 4.36.0 (2026-09-30, MIT; wasm runtime) — **Situational:** a small *living* character/object (a lamp that wakes, a plant that grows) with state machines. Requires authoring `.riv` files in the Rive editor (human work).
* `@lottiefiles/dotlottie-react` 0.19.16 (2026-08) — **Situational** if you have After-Effects/Lottie assets; otherwise skip.
* `three` 0.186 (20 MB unpacked) + `@react-three/fiber` 9.8 — **Don't unless the concept is inherently 3D.** `ogl` 1.0.11 (Unlicense, 2025-01) is the lightweight WebGL route for one shader (e.g., a paper-curl or ink-reveal).
* `matter-js` 0.20 (2024) — physics for tossed/stacking objects; **only if** a "pile of things you can toss" is a core idea. Motion springs + drag cover most "physical" needs.

### UI primitives & icons
* Don't adopt a component-kit *look*. If needed, use **headless** primitives for focus/dialog/popover correctness (Radix UI / Base UI — not version-checked here). `vaul` 1.1.2 (2024-12) drawer: only if a bottom-sheet fits.
* Icons: `lucide-react` 1.52.0 (ISC, updated today) for *functional* controls only. Personality icons should be hand-drawn SVG. (A uniform stock icon set is a "template" tell.)
* Note on the host stack: this repo already uses **Vite + React 19 + TypeScript + Tailwind 4 + vite-plugin-pwa**. For the notebook I recommend the same shape (a static-ish SPA/PWA, installable to her home screen, works offline) rather than Next.js, **unless** we need server-side access control or image optimisation.

### Scrolling
* Native scroll + CSS `scroll-snap` + scroll-driven animations. **Never hijack scroll.**
* `lenis` 1.3.26 (2026-08, MIT) — **Situational/optional.** Has a `respectReducedMotion` option; known friction with `position: sticky`, nested scrollers and iOS. If we want "smooth", it must be tested on real phones.

### Visual effects
Grain/paper (SVG filter or a small tiled texture — tiny, compressible); `mix-blend-mode: multiply` for photos-on-paper; layered soft contact shadows (vary per object); CSS `clip-path` reveals. `canvas-confetti` 1.9.4 (ISC, 2025-10): avoid (cliché). `tsparticles` 4.4 (14 deps): reject.

### Audio
Native `<audio>` / Web Audio is enough for voice notes and 3–5 tiny UI sounds. `howler` 2.2.4 (last publish **2023**, MIT) works but is dormant. `tone` 15.1 is for synthesis — overkill. **Rules:** opt-in, never autoplay (browsers require a gesture anyway, esp. iOS), obvious mute, preload only what's needed.

### Accessibility & QA
Native `prefers-reduced-motion`, `@media (hover: hover) and (pointer: fine)`, `focus-visible`; Playwright + Chromium is preinstalled in this environment → screenshot at mobile (390 px) and desktop for visual QA; Impeccable `audit` covers a11y/perf/responsive by checklist (its automated detector is not installed). An axe-core pass is advisable (not evaluated here).

### Page-flip (explicitly checked)
`page-flip`/StPageFlip 2.0.7 and `react-pageflip` 2.0.3 were last published **April 2021** — abandoned, canvas/fixed-size, poor a11y. A 2026 fork `react-pageflip-enhanced` exists (not reviewed). **Recommendation:** build the page turn ourselves with CSS 3D transforms + Motion drag (+ a subtle shadow gradient), or avoid literal page-flips and use a *different* transition metaphor. Decide at concept time.

---

## 7. Design references

> **Verification status:** I could not open these sites (the example-listing hosts and Awwwards are blocked here; the sites themselves weren't tested). They come from 2026 roundup articles surfaced by search — [Vev](https://www.vev.design/blog/scrollytelling-examples/), [Really Good Designs](https://reallygooddesigns.com/scrollytelling-website-examples/), [Shorthand](https://shorthand.com/the-craft/scrollytelling-examples/index.html), [Maglr](https://www.maglr.com/blog/best-scrollytelling-examples), [scrollytelling.ai](https://scrollytelling.ai/examples/) — and I give **names, not URLs**, so nothing here is guessed. Open the roundups, watch each on a phone, and tell me which resonate; that taste signal is worth more than my reading.

| Project | What the write-ups say | Technique to study | Could inspire our notebook |
|---|---|---|---|
| **The Boat (SBS)** | 49-page story, 222 hand-painted illustrations, 59 animated sequences; scroll drives animation so *reader's pace = story's pace* | Scroll-scrubbed sequences, painterly asset pipeline, pacing | Her scrolling/tapping speed *is* the rhythm; one memory = one scrubbed scene |
| **Who's Guilty** | Fully illustrated landing page, scribble-style animation, "flipping through a living sketchbook" | Hand-drawn line animation, humour in copy | Playfulness through drawn motion rather than UI chrome |
| **Gegen Menschenhandel** | Paper cut-outs and textures, z-pattern layered text moving on scroll | Physical layering/depth, cut-paper aesthetic | Collage depth without stock "scrapbook" assets |
| **Datarock** | Band history from 2005: photos, illustrations, video, scroll effects | Timeline as scrapbook, mixed media | Relationship timeline made of real artefacts |
| **Norway Salvation Army (Julie's story)** | Warm illustration, characters change within one persistent scene as you scroll | One scene, evolving content; continuity | One "room" that changes across memories |
| **Apple Notes (skeuomorphic era)** | Lined paper, torn edges, leather (historical) | Material metaphor *and* why it fell out of fashion (kitsch when literal) | Cautionary: texture must be subtle and purposeful |
| **Junk-journal / scrapbook practice** (craft, not web) | Layered ephemera, tape, handwritten marginalia | Composition by accumulation | Source of layout and annotation behaviours |
| **Digital-gardens movement** | Non-linear, interlinked personal notes | Wander-able structure instead of a feed | "Explore every corner" navigation instead of a menu |
| **Codrops tutorials** ([WebGL tag](https://tympanus.net/codrops/tag/webgl/)) | Fold/curl, displacement reveals, GSAP + shader recipes | Page-fold math, image reveal shaders | Source of recipes *if* a custom paper/ink effect is needed |

**Anti-references:** the digital-love-letter generators (LoveTale, GiftFeels, Letters by Heart, 2-LUV, Etsy/Canva "interactive letter" templates): envelope animations, rose/heart palettes, staged "15 magical steps".

---

## 8. Emotional design principles (for *this* notebook)

1. **One-of-one test.** For every screen: *could this be sent to another couple with the words swapped?* If yes, it's a template. Specific beats pretty (the exact ticket, her exact phrase, the real photo, the joke only you two get).
2. **Content is the decoration.** Her photos, your handwriting, scanned/recorded real things. Don't add roses; add the actual café receipt.
3. **Make it feel *found*, not delivered.** Discovery beats presentation: things tucked in margins, objects that react when touched, a page that is slightly different the second time. Never hide anything essential behind a discovery.
4. **Curiosity loops:** tease → reveal → afterglow. A glimpse (corner of a note sticking out) → an action (tap/drag) → a payoff (the memory) → a small residue (the note stays slightly moved, a smudge, a tiny annotation "you found it").
5. **Visible effort, invisible friction.** The delight is "someone spent way too long on this" — *hand-placed* rotations, bespoke illustrations, custom copy in different voices (headings, margin notes, captions). Yet navigation must be obvious on first try.
6. **Earn the big moments.** Rare/first-time → theatrical (Emil's table). Repeated → fast. Maybe 3–5 truly big moments in the whole notebook.
7. **Imperfection with a seed.** Randomness is generated once and *stored* (stable rotation/offset per object) so the layout doesn't jitter on re-render and is the same on each visit — like real paper.
8. **Voice.** Write like a person (Impeccable/Anthropic guidance: plain, specific, active, sentence case; empty/error states warm *and* clear). Several voices: narrator, margin scribble, caption.
9. **Time as a material.** The notebook can remember: what she last opened, date-aware notes (anniversary, "on this day"), a "pages you haven't opened yet" hint. (Keep privacy local/simple.)
10. **Restraint is romantic.** Fewer, better moments. One memorable signature element (Anthropic's "spend your boldness in one place" + "remove one accessory").

**On romantic imagery:** avoid hearts/roses/pink-gradients as *decoration*. Allow them only if she literally uses them (her real doodles).

---

## 9. Motion principles

* **Pick one motion personality** (motion-design): likely **Playful-but-gentle** — spring with small overshoot (≈3–10%) for touch, **Tenderness/Calm** curves (soft ease-in-out, 600–1000 ms) for reveals and scene changes, never Corporate snappiness for the emotional layer.
* **Three signature constants:** one signature easing (80 % of uses), three durations (quick ≈150 ms / standard ≈300 ms / slow ≈700 ms), one entrance pattern. (Starter tokens: `design-research/motion/motion-system.md`.)
* **Motion answers touch.** Prefer interaction-triggered motion to ambient animation (Anthropic guidance: non-user-triggered motion only to draw attention; one orchestrated moment beats scattered effects).
* **Three layers:** primary (what she follows), secondary (shadow lag, a note settles), ambient (paper breathing, dust, very slight) — ambient pauses when the tab is hidden and is off under reduced motion.
* **Physical honesty:** things have mass; paper ≈ 1.0× duration with 3–5 % overshoot (motion-design material table); nothing appears from `scale(0)`; transform-origin where it came from.
* **Interruptible:** use CSS transitions / springs, not fixed keyframes, for anything she can re-trigger mid-flight.
* **Only animate `transform`/`opacity`** (and clip-path/filters sparingly); never layout properties; blur only to mask a transition.
* **Shared-element continuity** (photo thumbnail → full memory) is the highest-value transition: it tells her *where she is*. Motion's layout animations or View Transitions both do this.
* **Test slow-motion + on a mid-range phone.** Review again "the next day" (Emil).

## 10. Interaction principles

* **Interaction is the emotion.** A memory she *uncovers* (peel tape, lift flap, drag a photo, rub away a smudge, trace a path) lands harder than one that is displayed. Each gesture should map to a physical metaphor she already knows.
* **Every gesture has a plain fallback** (tap, keyboard). Drag-to-reveal ≠ the only way.
* **Touch-first, hover-second.** Hover effects are a desktop *bonus* behind `@media (hover:hover)`; on touch, use press/hold/drag.
* **Feedback within ~100 ms** (press scale, shadow shrinks); release settles with a spring.
* **Pointer events + pointer capture** for drag; damping at edges rather than hard stops; momentum on release (Emil).
* **No custom cursors, no scroll-jacking, no forced sequences.** She stays in control; everything skippable.
* **Idle invites:** an object that gently nudges after 6–8 s of nothing teaches that it's touchable, then stops.
* **Persistence of touch:** where she moved something, it stays moved (local storage) — the notebook becomes *hers*.

## 11. Typography principles

* **Two to three voices, clearly distinct:** a *reading serif* (warm, readable at length), a *handwritten annotation* voice (short only — legibility drops fast), optionally a *typewriter/ephemera* voice for "found documents".
* **Hand lettering is for feelings, serif is for stories.** Never set paragraphs in a script font.
* **Draw-on handwriting for 1–8 words**, with the real text in the DOM (screen readers, copy, translation).
* **Scale & rhythm:** intentional type scale; line length < 70–80 ch; serif gets slightly more line-height.
* **Imperfect baselines for annotations** (rotation −3°…+3°, slight offsets) — seeded and stable.
* **Variable fonts + subsetting** to keep weight low; `font-display: swap`; preload the one display face.
* **Language/script first.** Most handwriting Google Fonts are Latin-only. If any content is Arabic/French accents/etc., choose fonts that cover it (or use real handwriting images/SVG). **Decide before picking type.**
* **Avoid the AI-typography tells** (Anthropic's list): one-word-in-italic headline accent, ALL-CAPS tracked eyebrow above every heading, spaced-em-dash labels, `→` on every link, monospace micro-labels everywhere.

## 12. Responsive principles

* **Design phone first — she will probably open it there.** (Ask; if it's a shared desktop moment, flip the priority.)
* **Same story, recomposed — not shrunk.** Scatter layouts become vertical stacks with *more* overlap/rotation; set-pieces re-choreograph for thumbs (bottom reach zone; avoid top-corner controls).
* `100dvh`/`svh`, `env(safe-area-inset-*)`, 44–48 px touch targets, no hover-only content, no horizontal page scroll.
* **Weight budget for mobile data:** responsive `srcset` images (AVIF/WebP), lazy-load below the fold, subset fonts, defer Rive/WebGL until needed, video posters. Test with CPU 4× throttle.
* **Installable PWA** (host repo already uses `vite-plugin-pwa`): opens from her home screen like an app, works offline.
* **Gyroscope/tilt** needs a user gesture + permission on iOS — treat as optional garnish.
* **Orientation:** make landscape graceful, not a separate design.

## 13. Accessibility principles (without losing the soul)

* **`prefers-reduced-motion`: replace, don't delete.** Swap travel/spring for a soft crossfade; keep the *information and the emotion* (a photo still reveals, just by fading). Stop ambient loops. Skippable always.
* **Handwriting legibility:** minimum size and contrast for script text; never place it over busy photos without a paper backing.
* **Real text in the DOM** for anything drawn/animated; decorative SVG `aria-hidden`.
* **Alt text as storytelling:** write captions-as-alt in the notebook's voice ("the rainy day we missed the last tram") — accessible *and* charming.
* **Focus states as part of the aesthetic:** a hand-drawn outline/underline, but always visible and ≥3:1 contrast.
* **Keyboard/AT paths** for drag/reveal interactions (buttons that perform the same action).
* **Sound:** opt-in, captions/transcripts for voice notes.
* **Colour:** warm palettes still need 4.5:1 for body text; check paper-texture backgrounds with real contrast tools.
* **No flashing**, no parallax that spans the whole viewport.

## 14. Anti-patterns

* Hearts, roses, pink gradients, "Be Mine" typography, envelope-opens-and-letter-rises as the *whole* idea.
* The AI "analog" uniform: **warm cream background + high-contrast serif + terracotta/clay accent + grain overlay + eyebrow caps**. (Anthropic's `frontend-design` explicitly lists this as a default tell.)
* Faux-scrapbook skin: stock tape/washi PNGs, identical paper cards with the same rotation and shadow.
* Everything-animates: fade-up on every section, hover transitions on every card.
* Scroll-jacking, forced timelines, unskippable intros, autoplay music, custom cursors.
* "Cutesy" error/empty copy that hides what happened.
* Dependencies for effects the platform does natively (smooth-scroll + parallax + particles + 3D "because").
* A menu/hamburger nav on a thing meant to be explored — or the opposite, a mystery-meat nav with no way back.
* Lorem ipsum or generic captions; anything you couldn't say to her in person.
* Public URL with private photos; search-indexable pages; analytics trackers on a love letter.
* Hover-only reveals; layouts that only work at 1440 px.
* Ephemera clutter that hurts legibility.

---

## 15. Preliminary design philosophy — what should the application *feel like*, *do*, and *never be*?

**It should feel like** a notebook that has been lived in — handled, annotated, kept — by someone who thought about *her* the whole time. Warm without being sweet. Playful without being childish. Slightly magical in the way a good pocket-sized object is: you keep finding another small thing. The feeling to leave her with is not *"what a nice website"* but *"they noticed that"* — so the emotional engine is **specific attention**, not decoration.

**It should do** three jobs, in this order of priority:
1. **Be easy to enter and hard to get lost in** (behavioral level). First 5 seconds: she knows where to touch.
2. **Make her *discover* things** (curiosity loops): memories are found by touching, dragging, lifting, tracing; each has a physical metaphor, a payoff, and a small residue.
3. **Hold real meaning** (reflective level): your actual words, photos, handwriting, jokes, dates. Design amplifies content; it never replaces it.

**Visual world:** committed to one world chosen from *her* (colour from her things, texture from real paper you could photograph, type from real handwriting if possible). Not a themed template. One memorable signature element; everything else quiet.

**Motion with personality:** one personality (gentle-playful springs; tender slow reveals), few big moments, instant response everywhere else, always interruptible, always skippable, always degradable.

**Never:** generic, corporate, cluttered, clever-for-its-own-sake, stock-romantic, inaccessible, public, slow on her phone.

**Decision rules (use when in doubt):**
1. Specific > beautiful. 2. Interaction > display. 3. Rare moments earn spectacle; repeated ones earn speed. 4. Platform before library; one library before two. 5. If it needs a hover, it needs a tap. 6. Every flourish must survive `prefers-reduced-motion` as a crossfade. 7. Remove one accessory before shipping. 8. Test on her phone, not mine.

**Build order when the concept arrives:** (a) your written brief + gather real assets (photos, handwriting scans, voice notes, dates) → (b) `/impeccable shape` + `init` (PRODUCT.md) → (c) pick world, type, motion personality (one page of tokens) → (d) build the *one* signature interaction first, on a phone → (e) content pages with the cheap, consistent micro-interaction layer → (f) set-pieces → (g) critique/audit/polish, reduced-motion & a11y pass → (h) privacy/hosting/PWA.

### Open questions I will need answered with the concept
1. Which **language(s)/script(s)** (Latin only? French accents? Arabic/RTL?) — drives fonts and layout direction.
2. **Device**: phone, laptop, tablet? iPhone or Android? (Permissions, PWA, gyro.)
3. **How she receives it**: link, QR, installed app, in person? Needs a passcode? One sitting or revisited over time?
4. **Assets**: real handwriting? scanned ephemera? photos (volume, orientation)? voice notes? music (licensing)?
5. **Tone range**: how playful vs. how tender; any hard no's (things she dislikes, sensitive memories)?
6. **Does it grow** (you keep adding pages) or is it one finished gift? (Affects CMS vs. static content.)
7. **Privacy:** where hosted, who can access, whether the repo may be public (private photos must not live in a public repo).

### Suggested follow-ups (need your OK; I did not do them)
* Review and install the **official Motion AI Kit** yourself from motion.dev (blocked here).
* Optionally install Impeccable's **detector engine** after you review its Rust source/releases.
* Bookmark/open the five roundup articles in §7 and tell me which projects resonate.
* Move this research and `.claude/skills/` into the **new notebook repo** (use `design-research/scripts/install-skills.sh <new-repo>`); keeping them in this planner repo is a convenience, not a recommendation.
