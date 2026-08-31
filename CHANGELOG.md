# Changelog

All notable changes to **Engine Visualizer** will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/) and follows [Semantic Versioning](https://semver.org/).

---

## 2026-08-30

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
