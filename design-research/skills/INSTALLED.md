# Installed skills — provenance, evaluation, security review

Installed into `.claude/skills/` (project scope). Every source was cloned shallow, read, and scanned
(executables, network calls, obfuscation, prompt-injection strings) **before** copying.
Re-create on any machine/project with `design-research/scripts/install-skills.sh <target-dir>` (pinned SHAs, file copy only).

| Skill dir(s) | Source | Pinned commit | License | Type | Why it is in the stack |
|---|---|---|---|---|---|
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`plugin/skills/impeccable`) | `6e802bd` (2026-10-04) | Apache-2.0 | Agent skill, 24 commands, ~40 playbooks | Design *direction* and *critique* system: `shape`, `critique`, `typeset`, `layout`, `animate`, `delight`, `bolder`/`quieter`, `polish`, `audit`. Has an **Experience** mode ("the artifact leads, the interface recedes") that matches the notebook. Its anti-"AI slop" rules are what stop the generic look. |
| `motion-design` | [lottiefiles/motion-design-skill](https://github.com/lottiefiles/motion-design-skill) | `f9a8a04` (2026-05-18) | MIT | Agent skill, pure markdown (17 files) | The only skill found that maps **emotion → motion** (`director/emotion-mapping.md` has a *Tenderness* and *Curiosity* row), plus Disney principles, motion personality archetypes, choreography. This is the "motion with personality" brief. Library-agnostic. |
| `emil-design-eng`, `animate`, `review-animations`, `find-animation-opportunities` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `e8a175d` (2026-10-02) | MIT | Agent skills, pure markdown | Craft-level correctness: easing/duration tables, interruptibility, never `scale(0)`, springs, gestures, clip-path reveals, `@starting-style`, transform/opacity-only rule, reduced motion. Acts as the **quality brake** against over-animating. Written by a Vercel/Linear design engineer. |
| `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-react`, `gsap-performance` | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) (official) | `aed9cfd` (2026-04-21) | MIT (skills); GSAP itself: free "no charge" license | Agent skills, pure markdown | Correct GSAP usage (incl. `useGSAP`, ScrollTrigger, SplitText, Flip, Draggable, MorphSVG, DrawSVG — all free since Webflow's acquisition). Prevents the usual hallucinated/outdated GSAP API. Only 6 of 8 installed (see below). |

## Security review notes

* **No executable code installed.** `find .claude/skills -name '*.sh' -o -name '*.js' -o -name '*.py' -o -perm -u+x` → empty.
* **Impeccable: engine deliberately NOT installed.** Upstream ships `scripts/impeccable`, a launcher that on first run downloads a native binary from GitHub Releases into `~/.impeccable/bin/` (verified against a `.sha256` sidecar served from the *same* origin — integrity, not authenticity) and, via the plugin `hooks.json`, runs it on SessionStart / every Edit|Write / Stop. That conflicts with the "avoid unknown binaries" rule, so I removed `scripts/` and did not install hooks. Cost: lose the 61 deterministic detector rules, `live` browser-iteration mode, and `critique` score history. The skill documents a "Launcher unavailable" path, and I added a clearly-marked local note to `SKILL.md` Setup so a future session doesn't try to fetch it. **If you want the detector later**, review `crates/` + release workflow, then `npx impeccable install` yourself.
* Third-party `LICENSE` files kept alongside Impeccable, Emil's and GSAP's skills.
* Scan hits: only a localhost dev-server CSP snippet in Impeccable's `live-setup.md` and an anti-injection warning in Emil's skill. No `curl|sh`, `eval`, base64, credential paths.
* No secrets were read, created, or committed. No system configuration touched. `package.json` untouched (no npm packages installed — see "why no packages" in the main doc).

## Not installed here, with reasons (also in main doc)

| Candidate | Verdict | Reason |
|---|---|---|
| [anthropics/skills `frontend-design`](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Read, extracted lessons, **not installed** | Impeccable was started from it and supersedes it; two overlapping design skills double-trigger. Its sharpest idea is kept in `DESIGN_PRINCIPLES.md`: *a warm-cream + high-contrast serif + terracotta palette is now the single most common AI-generated "personal/analog" look* — a real risk for a scrapbook brief. |
| Official **Motion AI Kit** (motion.dev/docs/ai-kit) | **Could not inspect** — `motion.dev` blocked by this sandbox's egress proxy | Not installing unseen code. Emil's skill + the Motion docs cover the gap. Recommended follow-up: you run `npx skills add` from their page after reading it (it may also bundle a Motion+ MCP that needs a paid account — unverified). Community "Motion" skills (jezweb, pedronauck, 199-biotechnologies…) not reviewed → skipped. |
| `vercel-labs/agent-skills` `web-design-guidelines` | **Rejected** | At runtime it tells the agent to WebFetch instructions from a mutable `raw.githubusercontent.com/.../main/command.md` and obey them. Remote text becoming instructions is a supply-chain/prompt-injection channel I won't wire into the project. (`react-best-practices` is solid but is performance, not feeling; `react-view-transitions` is *conditional* — see main doc.) |
| `nextlevelbuilder/ui-ux-pro-max-skill` | Rejected | 30 MB, Python search scripts + a database of "product-type → style" recommendations. That is exactly the generic style-matching ("fintech → X") this project must avoid; also redundant with Impeccable. |
| `wilwaldon/Claude-Code-Frontend-Design-Toolkit` | Discovery source only | Aggregator list (last updated April 2026); several install commands are third-party marketplace links I couldn't verify. |
| `mae616/design-skills` (5 skills) | Rejected | Accessibility/usability coverage duplicated by Impeccable `audit`/`harden`/`critique`. Last commit Jan 2026. |
| `MengTo/Skills` | Rejected | 156 MB mixed bag (3D, game combat, media). Far too broad; no review budget. |
| `LibreUIUX-Claude-Code` (152 agents / 70 plugins) | Rejected | Dependency bloat by design. |
| `taste-skill`, `bencium-*` | Not reviewed | Only known via the toolkit list; overlap Impeccable. Revisit if Impeccable's output feels too loud (`quieter`/`bolder` already cover it). |
| GSAP `gsap-frameworks`, `gsap-utils` | Skipped | Vue/Svelte/Nuxt guidance and utility helpers; the notebook is React. Add later if needed. |
| Emil's `animate-expo`, `write-swift`, `mobile-native`, `ask-sonner`, `pick-ui-library`, `prototype`, `break-ui`, `apple-design`, `animation-vocabulary` | Skipped | Native/Expo/Sonner-specific or outside current needs. `apple-design` (gesture/spring physics for touch) and `animation-vocabulary` (helps *you* describe motion precisely) are the two most likely to be worth adding once we start building. |
