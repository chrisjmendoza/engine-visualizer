# Engine Visualizer

An interactive web application for exploring piston-engine geometry and motion. Enter engine dimensions, animate the crank mechanism, and watch how bore, stroke, connecting-rod length, and engine speed affect piston movement — using mechanically accurate slider-crank kinematics, not sinusoidal approximation.

**Status:** in development toward the first milestone — a single-cylinder slider-crank visualizer. See [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) for the full design and roadmap (inline, V, and flat multi-cylinder layouts are planned).

This is an educational kinematic visualizer and portfolio project, not an engineering-validation tool.

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

## Architecture

The application is a client-only Vite + React + TypeScript app with four layers (see [TECHNICAL_DESIGN.md §6](TECHNICAL_DESIGN.md)):

1. **Interface** (`src/components/`) — controls, calculated results, validation messages.
2. **State** (`src/state/`) — a Zustand store holding engine configuration and animation state.
3. **Simulation** (`src/engine/`) — pure, tested slider-crank math. No React, Three.js, or browser APIs.
4. **Rendering** (`src/scene/`) — React Three Fiber components that consume simulation output.

All lengths are stored internally in millimeters and angles in radians; unit conversion happens only at the UI boundary. The animation loop drives Three.js transforms directly and mirrors readout values into React state at a throttled rate, so the interface never rerenders per frame.

## Known limitations

- Single cylinder only (multi-cylinder layouts are a planned milestone).
- Kinematics only — no combustion, valve train, or four-stroke cycle state.
- Simplified geometry, not CAD-accurate component models.

## License

[MIT](LICENSE) © Chris Mendoza
