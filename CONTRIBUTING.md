# Contributing to Engine Visualizer

This is a solo portfolio project, but it is organized so outside contributions are possible. If you'd like to add something, open an issue first so we can agree on the approach.

## Before you edit anything

Read [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) — it is the authoritative description of the architecture, math, units, and milestone scope. Project conventions and critical invariants are summarized in `CLAUDE.md` at the repo root.

## Architecture overview

Four layers, strictly separated:

- **Simulation (`src/engine/`)** — pure TypeScript functions for slider-crank kinematics, displacement, and unit conversion. Must not import React, Three.js, Zustand, or browser APIs. All lengths in millimeters, all angles in radians.
- **State (`src/state/`)** — Zustand store for configuration, preferences, and animation controls. Never updated per animation frame.
- **Rendering (`src/scene/`)** — React Three Fiber components. They consume `MechanismState` from the simulation layer and must not own mechanical math.
- **Interface (`src/components/`)** — controls, results, layout. Unit conversion to/from display units happens here and only here.

## Ground rules

- Simulation math changes require matching unit tests (`src/tests/`). Known-position tests (TDC, 90°, BDC, full revolution) and invariant tests are the pattern to follow.
- Validation lives in `src/engine/validation.ts` (Zod). Invalid values must never reach the simulation or renderer.
- Keep the four-layer separation. If a change blurs a boundary, restructure before merging.
- Run the full check locally before pushing: `npm run lint && npm run format:check && npm test && npm run build`.

## Branching and commits

Work happens on feature branches, never directly on `main`:

1. `git checkout -b feature/<topic>` (or `fix/<topic>`).
2. Commit there, with conventional-commit-flavored subjects (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
3. Push and open a pull request; CI must pass before merging.
4. Update `CHANGELOG.md` for user-visible changes, in the same change.
