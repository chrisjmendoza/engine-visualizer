/**
 * Domain types for the rotary (Wankel) engine family.
 *
 * Rotary is a second engine **family**, not another `EngineLayoutId`: its
 * configuration shares no field with `CrankMechanismConfig` beyond compression
 * ratio and redline, because there is no bore, no stroke, and no connecting
 * rod to describe. The piston types in `./types.ts` are therefore left
 * untouched and these live alongside them (TECHNICAL_DESIGN.md §27).
 *
 * Canonical units are the project's (§8.1): lengths in millimeters, angles in
 * radians, speed in RPM. Two rotary-specific unit conventions matter enough to
 * state here:
 *
 * - **"Shaft angle" always means the ECCENTRIC-SHAFT angle**, the one a rotary
 *   tachometer reads and the one the store keeps in `crankAngleRad`. The rotor
 *   turns at one third of it. Anywhere this tree says θ, it is e-shaft.
 * - **Rotor phase offsets for multi-rotor engines are expressed in e-shaft
 *   terms too** — a two-rotor engine's lobes are 180° of *shaft* apart — and
 *   are divided by three at the point where rotor orientation is computed.
 *   Keeping one angular currency is what lets `rotaryCycle.ts` treat a phased
 *   rotor as an unphased one evaluated at `θ + phase`.
 *
 * Scene coordinate system (shared with the piston family): the eccentric-shaft
 * center is the origin, +Y toward what would be the cylinder head, +Z depth.
 * Unlike a piston engine the rotary has no privileged "up" — the housing's
 * major axis lies along X here, which puts the two lobes left and right.
 */

/**
 * The geometry of one rotor and its housing.
 *
 * A Wankel's housing is a **peritrochoid** — the curve traced by a point at
 * radius `generatingRadiusMm` from a circle rolling inside another — and the
 * whole mechanism is fixed by just three lengths plus the housing width:
 *
 * - **R, `generatingRadiusMm`**: rotor center to apex. Sets overall size.
 * - **e, `eccentricityMm`**: shaft center to rotor center, i.e. the throw of
 *   the eccentric lobe. Sets how "peanut-shaped" the housing is.
 * - **b, `rotorWidthMm`**: housing width along Z. The rotary's analog of bore
 *   in the displacement formula, and the only dimension that is a pure scale
 *   factor on volume.
 *
 * Their ratio K = R/e (`calculateKFactor`) is the rotary's analog of the
 * rod-to-stroke ratio: a shape parameter that changes the character of the
 * mechanism without changing its size. See `rotaryValidation.ts` for why K
 * must stay above 3.
 */
export interface RotaryConfig {
  /** Generating radius R: rotor center to apex, mm. */
  generatingRadiusMm: number;
  /** Eccentricity e: shaft center to rotor center, mm. */
  eccentricityMm: number;
  /** Rotor (housing) width b, mm. */
  rotorWidthMm: number;
  compressionRatio: number;
  /** Eccentric-shaft rpm, as a rotary tachometer reads. */
  redlineRpm: number;
}

/**
 * How many rotors the engine has.
 *
 * Bounded at three because that is as far as verified phasing data goes: a
 * four-rotor 26B exists, but its firing arrangement is not something to guess
 * at (see `ROTARY_ROTOR_PHASES`).
 */
export type RotaryRotorCount = 1 | 2 | 3;

/** A point in the scene's XY plane, millimeters. */
export interface RotaryPointMm {
  xMm: number;
  yMm: number;
}

/**
 * Instantaneous rotor geometry at a given eccentric-shaft angle — the rotary
 * analog of `MechanismState`, and the only thing `src/scene/` needs in order
 * to place a rotor.
 *
 * `apexesMm` is a fresh three-element array per call, so the frame loop should
 * prefer the scalar accessors in `rotaryGeometry.ts` (`rotorApexMm` into a
 * caller-owned target, `rotorAngleRad`) over calling this every frame (§18).
 */
export interface RotaryMechanismState {
  /** Eccentric-shaft angle this state was evaluated at, radians, as given. */
  shaftAngleRad: number;
  /** Rotor center C(θ), on the eccentric lobe at radius e from the origin. */
  rotorCenterMm: RotaryPointMm;
  /** Rotor orientation φ = (θ + phase) / 3, radians. */
  rotorAngleRad: number;
  /** The three apex positions, apex k at rotor angle φ + 2πk/3. */
  apexesMm: readonly RotaryPointMm[];
}

/** A rotary validation problem described in mechanical terms, tied to one input. */
export interface RotaryValidationIssue {
  field:
    | "generatingRadiusMm"
    | "eccentricityMm"
    | "rotorWidthMm"
    | "compressionRatio"
    | "redlineRpm";
  message: string;
}
