# Engine Visualizer

An interactive web application for exploring piston-engine geometry and motion. Enter engine dimensions, animate the crank mechanism, and watch how bore, stroke, connecting-rod length, compression ratio, and engine speed affect piston movement — using mechanically accurate slider-crank kinematics, not sinusoidal approximation.

This is an educational kinematic visualizer and portfolio project, not an engineering-validation tool.

## What it does

- **Real slider-crank motion.** Piston position comes from the exact geometry, so rod angularity is visible: the piston passes mid-stroke before the crank reaches 90°.
- **Watchable speeds.** Real engine speeds strobe at display frame rates (600 rpm is 10 revolutions per second), so rendered motion can be slowed from 1× down to 1/250× while every calculated readout keeps using true rpm.
- **Sixteen real engines.** One-click presets across seven brands — Honda, Mazda, Chevrolet, Toyota, Nissan, Ferrari, BMW — with per-cylinder bore, stroke, connecting-rod length, compression ratio, and redline. Every value is corroborated by at least two independent sources, cited in code comments with the market variant noted.
- **Multi-cylinder layouts.** Render an engine as an inline-3, -4, or -6: one proven slider-crank mechanism per cylinder, each phased by its real crank-throw offset (flat-plane 0-180-180-0 for a four, 120° pairings for a three and six), so the phase relationships of a real crankshaft are visible at a glance. Inline presets apply their true cylinder count automatically.
- **Kinematic curves.** Position, velocity, and acceleration vs. crank angle from the exact closed-form derivatives, with a live cursor and real-unit peak values at the current rpm — the shorter the rod, the more visibly the curves skew away from a sinusoid.
- **Four-stroke overlay.** An optional stroke badge tracks the 720° cycle (intake, compression, power, exhaust) with a 0–720° counter.
- **Side-by-side comparison.** Render two engines at a shared millimeter scale, driven by the same crank angle, with a difference table showing signed percentage deltas for every metric — and both engines' kinematic curves overlaid.
- **Compression modeled visually.** The cylinder head sits at the true clearance height above the piston at top dead center, so a 13:1 engine visibly squeezes where an 8.5:1 turbo engine leaves a tall gap.
- **Explain-it-to-me metrics.** Every calculated result can be expanded to explain what it means and the difference it makes in a real engine.
- **Shareable links.** The current configuration lives in the URL, so a comparison can be sent as a link.

## Getting started

```sh
npm install
npm run dev
```

Other commands:

| Command           | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `npm test`        | Run the unit and component test suite (Vitest) |
| `npm run build`   | Type-check and produce a production build      |
| `npm run lint`    | Static analysis (oxlint)                       |
| `npm run format`  | Format the codebase (Prettier)                 |
| `npm run preview` | Serve the production build locally             |

> On Windows, run the test suite from PowerShell rather than git-bash — Vitest's worker can intermittently fail to start under git-bash. CI (Linux) is unaffected.

## Architecture

A client-only Vite + React + TypeScript app with four strictly separated layers (see [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md)):

1. **Interface** (`src/components/`) — controls, calculated results, validation messages. The only place display-unit conversion happens.
2. **State** (`src/state/`) — a Zustand store holding engine configuration and animation state.
3. **Simulation** (`src/engine/`) — pure, tested slider-crank math and engine data. No React, Three.js, or browser APIs.
4. **Rendering** (`src/scene/`) — React Three Fiber components that consume simulation output and never own mechanical math.

All lengths are stored in millimeters and angles in radians. The animation loop drives Three.js transforms directly and mirrors readout values into React state at about 10 Hz, so the interface never rerenders per frame.

## Known limitations

- Inline layouts draw each cylinder in its own cutaway plane, side by side — not a true axial 3D crankshaft view. V and flat layouts are a planned milestone.
- Kinematics only — no combustion or valve train; the four-stroke overlay is the textbook idealization, without valve-timing overlap.
- The combustion chamber is modeled as a flat disc, so clearance height ignores chamber domes, piston dishes, and gasket volume.
- Simplified geometry, not CAD-accurate component models.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Work happens on feature branches with pull requests; CI runs lint, format check, tests, and a production build.

## License

[MIT](LICENSE) © Chris Mendoza
