# Changelog

All notable changes to **Engine Visualizer** will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/) and follows [Semantic Versioning](https://semver.org/).

---

## 2026-08-30

### chore: project foundation

- Technical design document (`TECHNICAL_DESIGN.md`) reviewed and amended: oxlint replaces ESLint (current Vite template default), rod-angle sign convention documented, live-readout throttling specified, reduced-motion behavior made explicit, and a Deployment/CI section added (GitHub Pages + GitHub Actions).
- Scaffolded Vite 8 + React 19 + TypeScript 6 project with Three.js, React Three Fiber, Drei, Zustand, Zod, Vitest, Testing Library, Prettier, and oxlint.
- Core domain types (`src/engine/types.ts`), constants and input ranges (`src/engine/constants.ts`), and the Zustand store (`src/state/engineStore.ts`) with play/pause/scrub semantics and reduced-motion-aware initial state.
- Repository documentation: README, CONTRIBUTING, CLAUDE.md, MIT license.
- CI workflow (lint, format check, test, build) and GitHub Pages deploy workflow.
