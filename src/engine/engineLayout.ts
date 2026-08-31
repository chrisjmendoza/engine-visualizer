/**
 * Multi-cylinder engine composition (TECHNICAL_DESIGN.md §24, §24a).
 *
 * An engine is N copies of the proven single-cylinder slider-crank
 * mechanism, one per cylinder, each driven at the engine's crank angle plus
 * that cylinder's crank-throw phase offset. This module is pure composition
 * over `calculateMechanismState` (§9) — it owns no slider-crank math of its
 * own, only the layout and phase bookkeeping that lets a rendering layer
 * place N mechanisms and animate them in the correct relative phase.
 *
 * This deliberately deviates from the §24 sketch in one respect: phase and
 * bank angles are stored in **radians** (`crankPhaseRad`, `bankAngleRad`),
 * not the sketch's `*Deg` fields, because the canonical-units rule (§8.1)
 * outranks the sketch. `src/engine/` stays pure TypeScript throughout —
 * no React, Three.js, Zustand, or browser API imports.
 *
 * Phase 1 (this file) ships layout kinds `"single"` and `"inline"` with
 * supported cylinder counts 1, 3, 4, and 6. `bankIndex` and `bankAngleRad`
 * are always 0 for these layouts, but exist now so V and flat layouts can be
 * added later without reshaping this type or the share-link encoding.
 */

import { normalizeAngleRad } from "./units";

export type EngineLayoutKind = "single" | "inline";

/** One cylinder's position and phase within an engine's layout. */
export interface CylinderDefinition {
  /** 0-based position along the crankshaft, front to back. */
  index: number;
  /** Bank the cylinder belongs to. Always 0 until V/flat layouts land. */
  bankIndex: number;
  /** This cylinder's crank-throw offset from cylinder 0's throw, radians in [0, 2π). */
  crankPhaseRad: number;
}

/** A complete engine layout: how many cylinders, and how their throws relate. */
export interface EngineLayoutDefinition {
  kind: EngineLayoutKind;
  /** Angle between banks, radians. 0 for single and inline layouts. */
  bankAngleRad: number;
  cylinders: readonly CylinderDefinition[];
}

/** Cylinder counts with a defined crank-throw phase table (see below). */
export const SUPPORTED_CYLINDER_COUNTS = [1, 3, 4, 6] as const;
export type SupportedCylinderCount = (typeof SUPPORTED_CYLINDER_COUNTS)[number];

/**
 * Textbook crank-throw phase tables, radians, cylinder order = position
 * along the crank, front to back. Cylinder 0's phase is always 0, so the
 * existing readouts, degree counter, and scrubbing remain referenced to
 * cylinder 1 unchanged when an engine grows beyond one cylinder.
 *
 * - inline-3 (120° crank): 0, 2π/3, 4π/3
 * - inline-4 (flat-plane, throws paired 1&4 up / 2&3 down): 0, π, π, 0
 * - inline-6 (throws paired 1&6, 2&5, 3&4): 0, 2π/3, 4π/3, 4π/3, 2π/3, 0
 */
const CRANK_PHASE_TABLES_RAD: Record<
  SupportedCylinderCount,
  readonly number[]
> = {
  1: [0],
  3: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3],
  4: [0, Math.PI, Math.PI, 0],
  6: [
    0,
    (2 * Math.PI) / 3,
    (4 * Math.PI) / 3,
    (4 * Math.PI) / 3,
    (2 * Math.PI) / 3,
    0,
  ],
};

/**
 * Builds and freezes the layout for every supported cylinder count once, so
 * `createEngineLayout` can return a shared immutable instance instead of
 * rebuilding one on every call — important since callers include per-frame
 * rendering code that must never allocate a fresh layout per frame.
 */
const LAYOUT_CACHE: Record<SupportedCylinderCount, EngineLayoutDefinition> =
  Object.fromEntries(
    SUPPORTED_CYLINDER_COUNTS.map((count) => {
      const phases = CRANK_PHASE_TABLES_RAD[count];
      const cylinders: CylinderDefinition[] = phases.map(
        (crankPhaseRad, index) => ({
          index,
          bankIndex: 0,
          crankPhaseRad,
        }),
      );
      const layout: EngineLayoutDefinition = {
        kind: count === 1 ? "single" : "inline",
        bankAngleRad: 0,
        cylinders: Object.freeze(cylinders),
      };
      return [count, Object.freeze(layout)];
    }),
  ) as Record<SupportedCylinderCount, EngineLayoutDefinition>;

/**
 * Returns the layout for a supported cylinder count; count 1 => kind
 * `"single"`, every other supported count => kind `"inline"`. The result is
 * a shared, frozen instance — treat it as immutable and safe to hold across
 * frames rather than recomputing.
 */
export function createEngineLayout(
  cylinderCount: SupportedCylinderCount,
): EngineLayoutDefinition {
  return LAYOUT_CACHE[cylinderCount];
}

/**
 * Type guard for untrusted numbers (share links, UI selects) — true only
 * for a cylinder count this module has a phase table for.
 */
export function isSupportedCylinderCount(
  n: number,
): n is SupportedCylinderCount {
  return (SUPPORTED_CYLINDER_COUNTS as readonly number[]).includes(n);
}

/**
 * A cylinder's instantaneous crank angle: the engine's shared crank angle
 * plus this cylinder's throw offset, normalized to [0, 2π) so callers that
 * compare or wrap angles (e.g. `calculateMechanismState` via a caller that
 * cares about angle-wrap equivalence) see a consistent range.
 */
export function cylinderCrankAngleRad(
  globalCrankAngleRad: number,
  cylinder: CylinderDefinition,
): number {
  return normalizeAngleRad(globalCrankAngleRad + cylinder.crankPhaseRad);
}
