# Changelog

All notable changes to **Engine Visualizer** will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/) and follows [Semantic Versioning](https://semver.org/).

---

## 2026-08-30

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
