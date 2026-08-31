# Engine Visualizer — project conventions

Interactive slider-crank engine visualizer. Vite 8 + React 19 + TypeScript 6, Three.js via React Three Fiber, Zustand state, Zod validation, Vitest tests. `TECHNICAL_DESIGN.md` is authoritative for architecture, math, and milestone scope — read the relevant section before changing a subsystem.

## Critical invariants

- **Units:** all lengths stored in millimeters, all angles in radians, speed in RPM. Convert to display units (mm/in) only at the UI boundary (`src/components/`). Never mix units inside `src/engine/` or `src/scene/`.
- **Layer separation:** `src/engine/` is pure TypeScript — no React, Three.js, Zustand, or browser API imports. `src/scene/` consumes `MechanismState` from `calculateMechanismState`; rendering code must never own mechanical math.
- **No per-frame React state:** the R3F frame loop mutates Three.js objects directly and mirrors readouts into the store at ~10 Hz (`READOUT_SYNC_HZ`). Never call a store setter every frame at 60 fps.
- **Coordinate system:** crankshaft center at origin, +Y toward the cylinder head, crank angle 0 = TDC. Rod angle positive when the crankpin swings toward +X.
- **Validation:** invalid geometry (`rodLength <= stroke/2`, non-finite, out-of-range) must be rejected in `src/engine/validation.ts` before reaching simulation or renderer.
- **Scrub semantics:** starting a scrub pauses playback; changing RPM or geometry never resets the crank angle.

## Commands

- `npm test` / `npm run test:watch` — Vitest
- `npm run build` — `tsc -b` then Vite build
- `npm run lint`, `npm run format:check` — oxlint, Prettier
- Full pre-push check: `npm run lint && npm run format:check && npm test && npm run build`
- Known local quirk: under git-bash, `npm test` can intermittently fail to collect tests ("no tests" / "Vitest failed to find the runner") — a git-bash/vitest worker incompatibility, worst right after `tsc -b`. Run tests from PowerShell for reliability, or re-run once in bash; CI (Linux) is unaffected.

## Conventions

- **Branch, don't commit to `main`.** Create `feature/<topic>` (or `fix/<topic>`), commit there, push, then merge into `main` (fast-forward) and push. This is a solo repo — do not open pull requests unless asked; the branch exists to keep the work reviewable in source control, not to gate it.
- Conventional-commit subjects; update `CHANGELOG.md` (Keep a Changelog style, dated sections) for user-visible changes.
- CSS Modules for component styling; global tokens in `src/styles/globals.css`.
- Tests live in `src/tests/` for engine math, colocated `*.test.tsx` for components.
