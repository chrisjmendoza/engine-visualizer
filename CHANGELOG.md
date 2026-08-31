# Changelog

All notable changes to **Engine Visualizer** will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/) and follows [Semantic Versioning](https://semver.org/).

---

## 2026-08-30

### feat: independent engine speeds, exposed and shareable

- **Speed controls for comparison mode.** A "Link engine speeds" toggle (linked by default) splits the two engines onto their own rpm inputs, each with an "At redline" button showing that engine's actual figure — so an S2000 at 9,000 rpm against an LS7 at 7,000 is two clicks, and the speed difference is visible in the animation rather than inferred from a table.
- **Split speeds are shareable.** `brpm` carries engine B's speed and its presence is what marks a link as unlinked (so "unlinked at matching speeds" survives the round trip); `bangle` carries engine B's crank angle when paused. A link without them leaves your current linking alone.
- **Fixed: engine B's metrics were computed at engine A's crank angle.** An audit while wiring the controls found that piston displacement from TDC, current piston-to-head distance, and connecting-rod angle all called the kinematics with the shared angle for both engines, and mean piston speed used the shared rpm — so every one of them was wrong for engine B the moment the speeds diverged. Each now resolves engine B's own angle and speed. The crank-angle row shows a real difference when unlinked and "—" when linked.
- **Repo hygiene**: added `.gitattributes` (`eol=lf`) so Windows checkouts stop producing CRLF files that fail the format check without anyone editing them.

### feat: shareable links, engine labels, power figures, independent redlines

- **Shareable links.** The current setup lives in the URL, so a comparison can be sent to someone: `?a=s2000-ap1&b=corvette-z06-c6-ls7&rpm=3000`. Configurations matching a known car are written as preset ids, others as raw numbers; pausing before copying captures the exact crank angle. Malformed or hand-edited links degrade gracefully, and every decoded configuration passes validation, so a link can never inject impossible geometry. The URL format is documented as an append-only contract in the design doc. A Copy-link button falls back to a selectable field if the clipboard is unavailable.
- **Labels under each mechanism** naming the matching car (or "Custom engine"), with `A`/`B` chips in comparison mode. They finally give the "Show component labels" checkbox something to control, and the camera reserves space for them only when shown.
- **Power and torque** for all 16 cars, two-source verified against each preset's documented market variant, with their peak rpms. Shown when the configuration matches a real engine, "—" otherwise. The F20C figure was corrected to 240 hp after a cross-check caught a European PS figure mismatched against a US torque number.
- **Independent engine speeds.** Comparison mode can unlink the two engines so each runs at its own rpm — the point being to watch a 9,000 rpm redline against a 7,000 rpm one in real time. Linked mode assigns rather than integrates engine B's angle, so the two can never drift apart in the low bits. Scrubbing phase-locks both; resuming lets them diverge.
- **Slower playback**: 1/100× and 1/250× added for high-revving engines, and the default is now 60 rpm at 1/2×, which is legible on load.
- **Fixed**: the stray divider and heading misalignment above Engine B when the two panels sat side by side — the separator now belongs to the layout that decides stacked-versus-columns.
- **Removed**: the prose mechanism-description sentences. Every value in them is a labeled row in the results table, and reflowing them on each update made the panel jump during playback.
- Full suite: 584 tests.

### feat: naturally aspirated 2.4 presets (KA24DE, K24A2)

- **Nissan 240SX (KA24DE)** — the US-market naturally aspirated twin-cam sibling to the JDM SR20DET Silvia already in the roster, so the two sides of the KA-to-SR swap story can be compared directly. 89 × 96 mm on a 165 mm rod: markedly undersquare, with the longest rod-to-stroke ratio of any four in the roster.
- **Acura TSX (K24A2)** — Honda's naturally aspirated 2.4, grouped under Honda. Its 10.5:1 compression and 7,100 rpm redline are TSX-specific; the Accord/Element/CR-V variants share the same 87 × 99 bottom end at different compression, noted in the source comments rather than added as near-duplicate entries.
- **New roster invariant**: no two presets may share an identical spec set, enforced by test — so cars that render identically can never pad the picker as the roster grows.
- Full suite: 410 tests, 16 presets across seven brands.

### feat: redlines, brand-grouped presets, metric explainers, squareness labels

- **Redline** is now part of every engine config (editable, validated 3,000–12,000 rpm), shown as a metric with a new **mean piston speed at redline** row — the equalizer stat (most performance engines converge on ~20–25 m/s at their limits). All preset redlines verified against two sources; F20C corrected to 9,000 rpm (8,900 was the US fuel cut) and B6 to 7,200.
- **Five new preset cars**: Ferrari 458 Italia (F136), Nissan Silvia (SR20DET), Skyline GT-R (RB26DETT), GT-R R35 (VR38DETT), and BMW M3 E46 (S54) — full sourced per-cylinder data. The Toyota GR86's FA24 was researched but dropped: its stock rod length could not be corroborated. The F136's rod length is flagged single-source in code.
- **Brand-grouped preset picker**: presets now organize under brand buttons with car counts (BMW, Chevrolet, Ferrari, Honda, Mazda, Nissan, Toyota); one brand expands at a time and the brand matching the current config auto-expands.
- **Clickable metric explainers**: every results/comparison metric label toggles an inline explanation of what the metric means and the difference it makes in an engine (keyboard accessible, Escape closes, one open at a time).
- **Bore-to-stroke squareness**: the ratio now carries its industry label — square, oversquare, or undersquare (±1% band for square), e.g. "1.12:1 · oversquare" for the LS3.
- Full suite: 395 tests.

### feat: piston-to-head distance and comparison difference table

- The results panel's static range row now shows what was actually asked for: **piston-to-head distance** — clearance height at TDC to clearance height + stroke at BDC (e.g. 9.05 – 95.05 mm at defaults) — plus a live current-distance-to-head readout. The live piston displacement from TDC remains. Backed by a new tested engine function `calculatePistonToHeadDistanceMm`.
- In comparison mode the two stacked results panels are replaced by a single accessible table — Metric | Engine A | Engine B | Difference — with signed percentage deltas ((B−A)/A, e.g. "+75.4%" for LS7 displacement vs the default engine). No winner highlighting by design: most metrics have no objectively better direction. Zero baselines and the shared crank angle show "—". The table scrolls in its own container on narrow screens; the page never scrolls horizontally.

### fix: responsive layout across all screen sizes

- Fixed the mobile viewport bug where the canvas inflated below a tall panel with the mechanism lost in dead space — the container now has a definite clamped height, so the auto-framing camera fills it correctly.
- Deliberate layouts per size range: compact single-line header and tightened control density on phones; two-column control/results arrangements on tablet portrait (600–900px) via container queries; a panel minimum width guard at the 900px side-by-side boundary; a wider panel with two-column results on ≥1600px desktops; and comparison mode showing Engine A/B panels side by side at 600–900px and ≥1200px (stacked on phones), mirroring the viewport's left/right arrangement.
- Verified with real headless-browser screenshots at 360, 768, 1024, 1440, and 1920px, in both single and comparison modes, with zero horizontal overflow at any width.

### chore: consolidate hosting on Vercel

- Removed the GitHub Pages deploy workflow and disabled Pages on the repo; Vercel (git-linked, auto-deploy on push to `main`) is now the sole host. The Vite `base` override is gone — the app serves from the domain root everywhere, including local dev (now `http://localhost:5173/`).

### feat: static piston-travel range readout

- The results panel now shows "Piston travel (from TDC): 0 – {stroke}" as a fixed reference directly above the live piston-displacement readout, in the selected display unit, per engine slot.

### chore: Vercel integration

- Vercel plugin for Claude Code enabled at project scope (`.claude/settings.json`), with the plugin's `AGENTS.md` conventions mirror.
- `vite.config.ts` base is now deploy-target aware: `/` on Vercel builds (`VERCEL=1`), `/engine-visualizer/` for GitHub Pages and local dev.

### feat: engine comparison mode and playback speed

- **Playback speed**: rendered motion can be slowed to 1/2×, 1/4×, 1/10× (new default), or 1/50× of real time — 600 RPM is 10 revs/second, which strobes at 60 fps. Slow-motion affects rendering only; every calculated readout still uses true RPM.
- **Comparison mode**: "Add comparison engine" renders a second complete mechanism beside the first at a strictly shared millimeter scale, driven by the same crank angle and RPM, so all visible differences are purely geometric. Engine B gets its own presets, geometry controls, and results panel ("Engine A" left, "Engine B" right, matching the viewport). The scene mechanism was refactored into a reusable per-config `CrankMechanism` component — the architectural stepping stone toward multi-cylinder layouts (§24).
- Full suite now 285 tests.

### feat: sports-car engine presets and compression ratio

- **Engine presets** (`src/engine/presets.ts`): one-click per-cylinder geometry for nine well-known engines — Honda S2000 AP1 (F20C) and AP2 (F22C1), Mazda Miata NA 1.6 (B6), NA/NB 1.8 (BP), and ND 2.0 (PE), Corvette C6 (LS3) and Z06 (LS7), Toyota Supra (2JZ-GTE), and Honda Type R (K20A). Bore and stroke come from factory specs; every rod length and stock compression ratio is corroborated by at least two independent sources (cited in code comments, market variants noted). Preset tests pin each engine's advertised displacement (within 2%) and factory compression ratio as independent literals.
- **Compression ratio** is now part of the engine configuration (dimensionless, validated 5–20:1). The clearance volume is modeled as a flat disc above the piston crown, so the rendered cylinder head sits exactly `stroke/(CR−1)` above TDC — a 13:1 Skyactiv visibly squeezes the piston while an 8.5:1 2JZ-GTE shows a tall gap — with the clearance band shaded distinctly and camera framing tracking the head position. New calculated results: clearance volume (cc) and clearance height at TDC. The compression-ratio input is unaffected by the mm/in display-unit toggle.
- Full suite now 221 tests.

### feat: first working single-cylinder visualizer (Phases 2–5)

- **Simulation** (`src/engine/`): slider-crank kinematics (`calculateMechanismState`), displacement/speed/ratio calculations, unit conversions, and Zod validation with mechanical-terms error messages and the authoritative `rodLength > stroke/2` cross-field rule. 57 unit tests covering known positions (TDC/90°/BDC/360°), invariant sweeps, and validation acceptance/rejection.
- **Scene** (`src/scene/`): React Three Fiber orthographic cutaway of the mechanism — piston, connecting rod, crank throw, cylinder guide with TDC/BDC markers. The frame loop owns the live crank angle in a ref, clamps tab-inactive deltas, and mirrors readouts to the store at 10 Hz; rod attachment is guaranteed structurally (local +Y from big end lands on the piston pin at every angle). Auto-framing derives bounds from config with a single shared zoom so axes are never distorted. WebGL-unavailable fallback and error boundary included. Transform mapping unit-tested over 48 angles × 3 configs without WebGL.
- **Interface** (`src/components/`): responsive two-region shell, geometry controls with per-field drafts (invalid values never reach the store; messages attach to the offending field via `aria-describedby`), play/pause/RPM/scrub controls, mm/in unit toggle that preserves physical dimensions, and a live calculation panel with a textual mechanism description. 30 component tests.
- **App**: viewport lazy-loaded so Three.js (~234 kB gzip) ships in its own chunk and controls render immediately. Full suite: 87 tests passing.

### chore: project foundation

- Technical design document (`TECHNICAL_DESIGN.md`) reviewed and amended: oxlint replaces ESLint (current Vite template default), rod-angle sign convention documented, live-readout throttling specified, reduced-motion behavior made explicit, and a Deployment/CI section added (GitHub Pages + GitHub Actions).
- Scaffolded Vite 8 + React 19 + TypeScript 6 project with Three.js, React Three Fiber, Drei, Zustand, Zod, Vitest, Testing Library, Prettier, and oxlint.
- Core domain types (`src/engine/types.ts`), constants and input ranges (`src/engine/constants.ts`), and the Zustand store (`src/state/engineStore.ts`) with play/pause/scrub semantics and reduced-motion-aware initial state.
- Repository documentation: README, CONTRIBUTING, CLAUDE.md, MIT license.
- CI workflow (lint, format check, test, build) and GitHub Pages deploy workflow.
