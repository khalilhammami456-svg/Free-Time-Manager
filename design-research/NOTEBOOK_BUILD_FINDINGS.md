# Notebook build findings — verified 2026-10-04

Generic, technical write-up of what was **tested** (not assumed) while preparing to build "the notebook" from its 124-page production spec. Personal details of the spec and photos live only in the gitignored `notebook-assets/private/` folder. **This repository is public** — never commit the real photos, the manifest, the spec PDF or the generated stickers (`.gitignore` already blocks them).

Legend: ✅ tested and working · ⚠️ works with a caveat · ❌ failed/blocked · ❓ not tested

## 1. Integration test of the spec's stack (real Chromium, React 19.3, Vite 8)
Source: `notebook-assets/tools/poc-integration/` (no photos inside; supply your own `public/test/photo.jpg` and copy models via `tools/fetch_models.sh`).

| Piece | Result | Evidence / caveat |
|---|---|---|
| `react-pageflip` 2.0.3 under React 19.3 | ✅ renders, `flipNext()` 0→1, **mouse-drag flip works**, `onFlip`/`onInit` fire, curl + shadow + perspective visible mid-turn (screenshot reviewed) | ⚠️ **Last published April 2021** (unmaintained) — pin the exact version and plan a custom fallback (spec already requires a "simplified transition mode"). ⚠️ **Gotcha:** StPageFlip overwrites inline `style` on the page *root* element → pages looked blank white until styling moved to an **inner wrapper div**. Pages must use `forwardRef`. ❓ `size="stretch"`, StrictMode, real touch devices not tested. |
| Fabric.js 7.4.0 | ✅ `FabricImage.fromURL`, scale/rotate/position, `toJSON()` → `loadFromJSON()` round-trip preserved angle/left/object count | API is promise-based in v7 (spec examples may assume older callback API). |
| idb-keyval 6.3.0 | ✅ Blob stored and read back byte-identical | |
| `@bunnio/rembg-web` 1.0.2 + onnxruntime-web 1.30 | ✅ returns a PNG blob with a real alpha matte using **self-hosted** models (`rembgConfig.setBaseUrl('/models')`; files `/models/<name>.onnx`) | ⚠️ Library is thin: 3 releases, single maintainer, README says "90% AI generated code". ⚠️ Pairs with onnxruntime-web `^1.23`; tested with 1.30 (works). ⚠️ Logs "No hash available" → **it does not verify model integrity** — use `tools/fetch_models.sh` (pinned SHA-256, tested incl. negative case). |
| Background-removal speed | ⚠️ headless, no GPU: silueta ≈ 4.8 s, u2netp ≈ 7.2 s for a 695×702 image (includes first model load; WASM single-thread) | README's "~1 s" figure is for a 3.9 GHz desktop. Needs real-phone testing. Multi-threading needs cross-origin isolation (COOP/COEP headers), which restricts third-party embeds. |
| **WebGPU acceleration** (spec Ch.16.2) | ❌ spec claim is wrong | The library's own README: *"none of the models are compatible with WebGPU execution providers … use WebGL or CPU"*. The `webgl` provider also failed headless and fell back to WASM. Don't promise GPU speed-ups. |
| Keep UI responsive (PERF-007) | ❓ | `SessionOptions.proxy` (run WASM in a worker) exists; **not tested**. Test before relying on it. |

**Alternatives checked:** `@imgly/background-removal` 1.7.0 is **AGPL-3.0** → bad fit; keep MIT `rembg-web`. `@huggingface/transformers` 4.3.0 (Apache-2.0) could run RMBG-class models; not evaluated. `heic-to` is LGPL-3.0, `heic2any` last released 2023 — HEIC handling needs its own decision (❓ untested; many phones convert to JPEG in the file picker).

## 2. Model comparison on 41 real photos (private, results only)
Models from the upstream rembg GitHub release (reachable from this sandbox). SHA-256s pinned in `tools/fetch_models.sh`.

| Model | Size | Verdict |
|---|---|---|
| `u2netp` | 4.6 MB | Fast, but drops hair/body on several portraits. Last-resort. |
| `silueta` | 44 MB | **Best default for a mobile PWA.** Good on face/portrait blobs and full-length figures; makes grey noise from curly/dark hair if the matte stays translucent. |
| `u2net_human_seg` | 176 MB | Best on full-body shots; treats close-up selfies as "all person" (keeps the background) and fails on sideways images. Too heavy for default; optional download. |

**Findings that change the build:**
1. **No model is reliable on its own** → the spec's fallbacks are mandatory, not optional: preview, retry, "Use original", and sticker styles that need no segmentation (Polaroid, taped photo, photo corners). In the test set 27/41 gave a good cut-out; 14/41 are better as framed photos (close-ups with no separable background, motion blur, mirror shots where the model picks the *reflection*, screenshots with UI overlays).
2. **Orientation first.** Photos stored sideways (4 of 41) produced garbage or upside-down stickers. Do EXIF auto-orient *and* offer manual rotate **before** segmentation (the spec's editor-then-sticker order is correct).
3. **Harden the matte.** Raw soft alpha + white sticker border = grey, ghosted hair. `tools/make_stickers.py::harden()` (smoothstep 0.30→0.70 + drop disconnected islands <3 % of the largest) fixed it; port the same step to the canvas pipeline.
4. My automated "quality" heuristic (foreground ratio + largest component) **missed most bad cut-outs** — visual review was necessary; don't ship an auto-judge. Also a Haar-cascade face detector was useless for auto-rotation (false positives on tilted selfies).
5. Overlays burned into photos (AR-filter dots, story UI bars, watermarks) survive cut-out — offer crop before sticker conversion.
6. Two source images carry a visible "Meta AI" watermark (possibly AI-generated/edited). The spec treats photos as authoritative and forbids fabricated variants → confirm with the author before presenting them as genuine memories.

## 3. Spec colour tokens vs the spec's own WCAG 2.2 AA requirement
Computed contrast (WCAG formula). The spec demands ≥ 4.5:1 for normal text and ≥ 3:1 for UI/large.

| Token (light) | Spec value | Measured | Problem | Suggested fix (≥ target on canvas, surface, alt) |
|---|---|---|---|---|
| `--color-text-muted` | `#6E7FA0` | 3.76 / 4.03 / 3.55 | ❌ fails 4.5 for metadata text | `#5F6D8A` (≥ 4.57) |
| `--color-success` | `#3E8A62` | 4.19 on white | ❌ as text | `#387E59` |
| `--color-warning` | `#B0862C` | 3.34 on white | ❌ as text | `#8D6B23` |
| `--color-lily` | `#7A9ED6` | 2.54 / 2.73 | ❌ as a *meaningful* graphic (e.g. secret markers, 3:1) · ✅ fine as pure decoration | `#6F90C3` for functional marks |
| `--color-rule` | `#C8D4E8` | 1.39 | ❌ as input/control borders (needs 3:1) · ✅ as decorative hairline | `#868E9B` for control borders |
| `--color-text-secondary`, `accent`, `error`, `text-primary`, `ink` | | 5.6 – 17 | ✅ | |
| Dark: all text tokens | | 4.5 – 15.8 | ✅ (`muted` on `surface-alt` 4.53 — razor-thin) | |
| Dark button | | white on `#6E9AF0` = **2.78** | ❌ | use dark canvas text on the dark accent (6.73) |

## 4. Internal inconsistencies in the spec (decide once, then write them into tokens)
* **Page-turn time:** 800 ms (Ch.7.9, Ch.9.3) vs `MOT-003` "page transitions ≤ 600 ms" vs `--motion-duration-slow` 600 ms. Suggest: 800 ms for the physical turn (treated as "cinematic"), 400–600 ms for everything else.
* **Reduced-motion page change:** `flippingTime` 600 ms "reduced" (Ch.9.3) vs 150 ms crossfade (Ch.7.9, Ch.41). Suggest: 150 ms crossfade, no curl.
* **Letter open:** 600 ms animation (Ch.7.9, 38.6, 75.3) vs "open < 500 ms" (Ch.8.4.4). Suggest: treat "< N ms" as time-to-interactive budget and the animation as 600 ms *only if* content is readable at ≤ 500 ms.
* **`NFR-004` "core reading works without JS"** vs a React SPA with a canvas page-flip. Low priority ("Should"); would need pre-rendered HTML.
* Ch.76's six diagrams are unresolved LaTeX refs (`??`) and the Ch.77 data-flow figure is truncated — no design information was lost, but the diagrams do not exist.
* Fonts: the spec's five families all exist on Fontsource (✅ verified: Newsreader, Source Serif 4, DM Sans, Caveat, Kalam, Fira Code). Caveat/Kalam are **Latin-only**; if any content uses another script, the handwritten voice needs a different font or real handwriting.

## 5. Assets
| Asset | Status |
|---|---|
| 41 private photos | ✅ extracted, catalogued (private manifest: rotation, kind, notes, flags), **never committed** |
| Starter sticker set | ✅ 27 cut-out stickers + 14 "framed photo" recommendations; each reviewed visually; regenerate with `tools/make_stickers.py` |
| Original blue-lily SVG set (10 files) | ✅ `notebook-assets/flowers/` — generated by `tools/make_lilies.py`, CC0, rendered and reviewed (clipping bugs found and fixed). Matches spec components: Illustration ×2, Bloom, Petal, Corner, Divider, PressedFlower, Line, Silhouette/ChapterMark, Watermark. ⚠️ Stylised, not botanical-plate quality; the single bloom reads slightly "lotus". |
| **Real blue-lily photos / botanical plates** | ❌ **blocked** — the org egress policy denies (403, or unreachable) `commons.wikimedia.org`, `upload.wikimedia.org`, `openaccess-api.clevelandart.org`, `www.biodiversitylibrary.org`, `archive.org`, `www.rawpixel.com`, `api.openverse.org`, `collectionapi.metmuseum.org`, `images.unsplash.com`, `huggingface.co`, `cdn.jsdelivr.net`, `unpkg.com`. I did not try to route around it. To enable: environment settings → Network access → Custom, add at least `commons.wikimedia.org` and `upload.wikimedia.org` (Wikimedia Commons has CC0/PD botanical images with machine-readable licences), optionally the Cleveland Open Access hosts. Then ask me to fetch; I will record licence + attribution for every file (spec Ch.35). |

## 6. Skills installed for the build (16 total — see `skills/INSTALLED.md`)
Added in this round (spec Ch.78 / Quick-Start step 2): `frontend-design` (Anthropic), `accessibility-inclusive-design`, `ux-writing-content-design`, `interaction-patterns-components` (hueyexe). Verified: markdown only, no executables, no network/eval/base64 patterns.

## 7. Hosting/privacy reminders that follow from the above
* The GitHub repo `khalilhammami456-svg/Free-Time-Manager` is **public** (checked via the GitHub API). The notebook must live in a **new private repo** (or other private store) before any real photo, letter or manifest is committed. `.gitignore` here blocks `notebook-assets/{source,private,stickers-private,models}`.
* This sandbox is ephemeral: the photos exist only in the container and in your original upload. Keep your own copy.
