/**
 * The stage: owns the single animation loop and places one or two engines on
 * it, each a row of one or more cylinders (§11, §12.1, §24).
 *
 * React subscribes only to the configurations and layouts (through the layout
 * passed in), so geometry is rebuilt when a dimension changes, a layout
 * changes, or comparison is toggled. Per frame nothing touches
 * React: one loop computes each cylinder's mechanism state at that cylinder's
 * own crank angle — the engine's angle plus the cylinder's crank-throw phase —
 * and mutates its Three.js groups through a reusable carrier (§18).
 *
 * Both engines always share the playback state. They also share a speed and an
 * exact crank angle while `rpmLinked` is set, so differences between them are
 * purely geometric; unlinked, each runs at its own rpm and the angles diverge,
 * which is how two different redlines can be watched side by side.
 *
 * A cylinder is drawn rotated about its own crankshaft center by whatever
 * `drawnRotationRad` decided for it (§24a) — normally its layout's bank offset,
 * but zero in the single-cylinder view and a further quarter turn when flat
 * engines are stood upright. Only the drawing is rotated, whichever of those
 * applies, so the loop below keeps driving it at exactly its crank phase. On a
 * V or flat engine the two cylinders of a throw share that crank center — same
 * `offsetXMm`, opposite tilts — so the row is a row of throws, and one of the
 * pair may omit its crank throw entirely (`drawsCrank`) when the other already
 * draws the pin they share. None of that reaches the loop either: every
 * cylinder is still driven at its own crank phase, and a cylinder with no crank
 * group is skipped by the same null check that covers an unmounted one.
 *
 * Each cylinder is also placed at a crank-center height (`offsetYMm`), which
 * is zero everywhere except the lower engine of a stacked comparison (§24a) —
 * the arrangement the layout picks when either engine shows more than one
 * cylinder. Nothing about the animation changes with it.
 *
 * While the "Four-stroke cycle" preference is on, the same loop also tints each
 * cylinder's combustion chamber by the stroke it is in — red firing, blue
 * exhausting, untouched through intake and compression — which is what makes a
 * firing order visible as a wave travelling down an inline-6 or a cross-plane
 * V8. Which stroke that is comes from the engine layer (`cylinderStrokePhaseAt`,
 * which needs the layout's real firing order, not just a crank phase); what
 * color it is drawn comes from `chamberTint.ts`, which writes a material only
 * when a cylinder's phase actually changes, so this is a handful of writes per
 * 720° cycle rather than one per cylinder per frame.
 *
 * Because `useMechanismRefs` is a hook, a variable number of cylinders cannot
 * own their refs here. Each cylinder is therefore a child component that holds
 * its own refs and carrier and registers an apply function with the stage; the
 * loop looks that function up by cylinder index. A cylinder that has not
 * mounted yet, or has just unmounted, is simply absent from the registry and
 * skipped — the same tolerance the single-mechanism code relied on when a
 * comparison engine appeared or disappeared between a store change and the
 * rerender that follows it.
 *
 * ## The rotary family (§27)
 *
 * Either stage slot may hold a rotary engine instead of a piston one, and the
 * layout says which (`SceneLayout`'s parallel `primary`/`primaryRotary`
 * fields). A rotary row is driven by the same loop, from the same live shaft
 * angle, with the same registry pattern and the same write-on-change tint —
 * every structural decision above carries over unchanged, and the rotary path
 * is a second branch in `applyFrame` rather than a second loop.
 *
 * Two things differ, and only two. First, a rotor's orientation is θ/3, so the
 * wrapped angle is not enough on its own: the loop's mod-6 revolution counter
 * supplies the missing revolutions through `rotaryCycleAngleRad`, which is the
 * *same* number the face tint is derived from, computed once per engine per
 * frame. Second, that number is needed whether or not the cycle preference is
 * on — a rotor has to be *placed* correctly even when nothing is being tinted —
 * so unlike the piston branch, which computes its cycle angle only when
 * tinting, the rotary branch always computes it and passes null only for the
 * tint.
 */

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { Group } from "three";
import { cycleAngleRad, cylinderStrokePhaseAt } from "../engine/cycle";
import type { StrokePhase } from "../engine/cycle";
import { cylinderCrankAngleRad } from "../engine/engineLayout";
import type { EngineLayoutDefinition } from "../engine/engineLayout";
import { calculateMechanismState } from "../engine/kinematics";
import { ROTOR_FACE_COUNT } from "../engine/rotaryConstants";
import { rotaryCycleAngleRad } from "../engine/rotaryCycle";
import type { RotorRevolutionIndex } from "../engine/rotaryCycle";
import type { RotaryConfig } from "../engine/rotaryTypes";
import type { CrankMechanismConfig, MechanismState } from "../engine/types";
import { applyChamberPhase, createChamberTintState } from "./chamberTint";
import type { ChamberTintState } from "./chamberTint";
import { CrankMechanism } from "./CrankMechanism";
import { MechanismLabel } from "./MechanismLabel";
import type { MechanismObjects } from "./mechanismTransforms";
import { applyMechanismState, useMechanismRefs } from "./mechanismTransforms";
import { RotaryMechanism } from "./RotaryMechanism";
import {
  applyRotorFacePhases,
  applyRotorPlacement,
  computeRotorPlacement,
  createRotorFaceTintState,
  createRotorPlacement,
} from "./rotaryTransforms";
import type {
  RotorFaceTintState,
  RotorObjects,
  RotorPlacement,
} from "./rotaryTransforms";
import type { RotaryProportions } from "./rotarySceneGeometry";
import type {
  MechanismProportions,
  PlacedCylinder,
  PlacedRotor,
  SceneLayout,
} from "./sceneGeometry";
import type { EngineStoreState, FrameAngles } from "./useMechanismAnimation";
import {
  revolutionParityOf,
  rotorRevolutionIndexOf,
  useMechanismAnimation,
} from "./useMechanismAnimation";

/** Which engine a cylinder belongs to. Matches the label slots. */
type EngineSlot = "A" | "B";

/**
 * What the frame loop can do to one mounted cylinder: move its parts, and
 * tint its combustion chamber for the stroke it is in.
 *
 * Two functions on one registry entry rather than two registries, so the loop
 * does one map lookup per cylinder per frame rather than two. `applyPhase`
 * takes `null` for "not tinting" — the preference is off — and is itself
 * responsible for writing nothing when the phase has not changed
 * (`chamberTint.ts`).
 */
interface CylinderDriver {
  applyState: (state: MechanismState) => void;
  applyPhase: (phase: StrokePhase | null) => void;
}

/**
 * What the frame loop can do to one mounted rotor: place it, and tint its
 * three faces for the phases they are in.
 *
 * The rotary's `CylinderDriver`, and the same shape for the same reason — one
 * registry entry, one map lookup per rotor per frame. `applyFacePhases` takes
 * `null` for "not tinting" and is itself responsible for writing nothing when
 * a face's phase has not changed (`rotaryTransforms.ts`).
 */
interface RotorDriver {
  applyPlacement: (config: RotaryConfig, shaftCycleAngleRad: number) => void;
  applyFacePhases: (shaftCycleAngleRad: number | null) => void;
}

/**
 * The mounted mechanisms of both engines, keyed by index within each engine.
 *
 * Two maps keyed by number rather than one keyed by `"A:0"` deliberately: the
 * frame loop looks every cylinder up on every frame, and building a template
 * string per cylinder per frame would allocate in the one place that must not
 * (§11, §18).
 *
 * A slot's cylinder map and its rotor map are never both populated — a slot
 * shows one family or the other — but keeping both keyed the same way means
 * the loop's two branches are structurally identical.
 */
interface MechanismRegistry {
  cylinders: Record<EngineSlot, Map<number, CylinderDriver>>;
  rotors: Record<EngineSlot, Map<number, RotorDriver>>;
}

interface MechanismStageProps {
  layout: SceneLayout;
}

export function MechanismStage({ layout }: MechanismStageProps) {
  const registry = useRef<MechanismRegistry>({
    cylinders: { A: new Map(), B: new Map() },
    rotors: { A: new Map(), B: new Map() },
  });

  /**
   * Drives each cylinder from its engine's crank angle plus its own throw
   * phase. The two engines are identical while their speeds are linked and
   * diverge once they are not, so a faster-revving engine visibly outruns a
   * slower one.
   *
   * The configurations are read from the store snapshot rather than from
   * props, matching the previous single-mechanism behavior: a frame landing
   * between a store change and React's rerender still behaves, because the
   * cylinders it drives are the ones actually mounted. The cylinder
   * definitions come from the layout, never from `createEngineLayout` — the
   * loop must not build a layout per frame.
   */
  const applyFrame = useCallback(
    (angles: FrameAngles, store: EngineStoreState) => {
      // The four-stroke tint reuses the "Four-stroke cycle" preference the
      // stroke badge is already gated by (§24a): same pedagogy, one switch.
      // Off, every cylinder is handed `null` and no material is ever written,
      // so the scene is byte for byte what it was before the tint existed.
      const showCycle = store.preferences.showCycle;

      if (layout.primary) {
        applyEngineFrame(
          registry.current.cylinders.A,
          store.config,
          layout.primary.layout,
          layout.primary.cylinders,
          angles.crankAngleRad,
          // The 720° position comes from the loop's own revolution counter —
          // the one notion of cycle position there is
          // (`useMechanismAnimation`) — read as `% 2`, never from a second one
          // invented here.
          showCycle
            ? cycleAngleRad(
                angles.crankAngleRad,
                revolutionParityOf(angles.crankRevolutionIndex),
              )
            : null,
        );
      }
      if (layout.primaryRotary) {
        applyRotaryEngineFrame(
          registry.current.rotors.A,
          store.rotaryConfig,
          layout.primaryRotary.rotors,
          angles.crankAngleRad,
          // The same counter, read as `% 3`: which of the three shaft
          // revolutions of the 1080° face cycle this is. Needed to place the
          // rotor whether or not anything is being tinted.
          rotorRevolutionIndexOf(angles.crankRevolutionIndex),
          showCycle,
        );
      }

      const comparison = store.comparisonConfig;
      if (comparison && layout.secondary) {
        applyEngineFrame(
          registry.current.cylinders.B,
          comparison,
          layout.secondary.layout,
          layout.secondary.cylinders,
          angles.comparisonCrankAngleRad,
          // Engine B works the same way from its own angle and its own
          // counter, which diverge from engine A's the moment the speeds are
          // unlinked.
          showCycle
            ? cycleAngleRad(
                angles.comparisonCrankAngleRad,
                revolutionParityOf(angles.comparisonCrankRevolutionIndex),
              )
            : null,
        );
      }
      if (layout.secondaryRotary) {
        applyRotaryEngineFrame(
          registry.current.rotors.B,
          store.comparisonRotaryConfig,
          layout.secondaryRotary.rotors,
          angles.comparisonCrankAngleRad,
          rotorRevolutionIndexOf(angles.comparisonCrankRevolutionIndex),
          showCycle,
        );
      }
    },
    [layout],
  );

  const { applyCurrent } = useMechanismAnimation(applyFrame);

  // Place the parts before the first painted frame, and again whenever the
  // layout is rebuilt, so nothing is ever drawn at the untransformed origin.
  useLayoutEffect(() => {
    applyCurrent();
  }, [applyCurrent, layout]);

  return (
    <group>
      {layout.primary && (
        <EngineRow
          slot="A"
          registry={registry}
          proportions={layout.primary.proportions}
          cylinders={layout.primary.cylinders}
        />
      )}
      {layout.primaryRotary && (
        <RotaryRow
          slot="A"
          registry={registry}
          proportions={layout.primaryRotary.proportions}
          rotors={layout.primaryRotary.rotors}
        />
      )}
      {layout.secondary && (
        <EngineRow
          slot="B"
          registry={registry}
          proportions={layout.secondary.proportions}
          cylinders={layout.secondary.cylinders}
        />
      )}
      {layout.secondaryRotary && (
        <RotaryRow
          slot="B"
          registry={registry}
          proportions={layout.secondaryRotary.proportions}
          rotors={layout.secondaryRotary.rotors}
        />
      )}

      {/* Labels are anchored in stage coordinates rather than parented to a
          mechanism, so they share one baseline and stay put while the parts
          move. The layout omits them entirely when labels are hidden, and a
          slot has exactly one label whichever family fills it. */}
      {layout.primary?.label && (
        <MechanismLabel placement={layout.primary.label} />
      )}
      {layout.primaryRotary?.label && (
        <MechanismLabel placement={layout.primaryRotary.label} />
      )}
      {layout.secondary?.label && (
        <MechanismLabel placement={layout.secondary.label} />
      )}
      {layout.secondaryRotary?.label && (
        <MechanismLabel placement={layout.secondaryRotary.label} />
      )}
    </group>
  );
}

/**
 * Drives every mounted cylinder of one engine: its transforms from the crank
 * angle, and its chamber tint from the engine's 720° cycle angle.
 *
 * Indexed loop and a numeric map lookup, so the only per-frame allocation is
 * the `MechanismState` each `calculateMechanismState` call returns — exactly
 * what the single-mechanism loop already did, once per cylinder (§18). The
 * tint adds none: `cylinderStrokePhaseAt` reads a frozen per-layout lookup and
 * returns a string literal, and the write it leads to is skipped unless the
 * phase actually changed.
 *
 * `engineLayout` is the whole architecture (`PlacedEngine.layout`), not the
 * placed cylinders, because a cylinder's place in the four-stroke cycle
 * depends on the engine's firing order and cannot be read off the cylinder
 * alone (see `cylinderCycleAngleRad`). `cycleAngleRadValue` is null exactly
 * when the cycle preference is off, and then no material is touched.
 */
function applyEngineFrame(
  mounted: Map<number, CylinderDriver>,
  config: CrankMechanismConfig,
  engineLayout: EngineLayoutDefinition,
  cylinders: readonly PlacedCylinder[],
  crankAngleRad: number,
  cycleAngleRadValue: number | null,
): void {
  for (let i = 0; i < cylinders.length; i += 1) {
    const cylinder = cylinders[i];
    const driver = mounted.get(cylinder.index);
    if (!driver) {
      // Not mounted yet, or already unmounted: nothing to transform.
      continue;
    }
    driver.applyState(
      calculateMechanismState(
        config,
        cylinderCrankAngleRad(crankAngleRad, cylinder),
      ),
    );
    driver.applyPhase(
      cycleAngleRadValue === null
        ? null
        : cylinderStrokePhaseAt(
            engineLayout,
            cylinder.index,
            cycleAngleRadValue,
          ),
    );
  }
}

/**
 * Drives every mounted rotor of one rotary engine: its placement from the
 * shaft angle, and its three face tints from the same number (§27).
 *
 * `rotaryCycleAngleRad` is computed **once per engine per frame**, before the
 * loop over rotors, and used for both jobs. That single call is what keeps a
 * rotor's drawn orientation and its faces' phases two readings of one clock
 * rather than two clocks that could drift; it is also the only place the
 * revolution index enters, which is where the check "does the rotor really
 * need more than the wrapped angle" has one answer instead of several.
 *
 * Every rotor of an engine shares that engine angle and differs only by its
 * own `rotorPhaseRad` — the exact analogue of a cylinder's crank-throw phase.
 *
 * `showCycle` is a flag rather than a nullable angle, unlike the piston
 * branch's `cycleAngleRadValue`: the angle is needed either way here, and only
 * the tint is optional.
 */
function applyRotaryEngineFrame(
  mounted: Map<number, RotorDriver>,
  config: RotaryConfig,
  rotors: readonly PlacedRotor[],
  shaftAngleRad: number,
  rotorRevolutionIndex: RotorRevolutionIndex,
  showCycle: boolean,
): void {
  const shaftCycleAngleRad = rotaryCycleAngleRad(
    shaftAngleRad,
    rotorRevolutionIndex,
  );

  for (let i = 0; i < rotors.length; i += 1) {
    const rotor = rotors[i];
    const driver = mounted.get(rotor.index);
    if (!driver) {
      // Not mounted yet, or already unmounted: nothing to transform.
      continue;
    }
    driver.applyPlacement(config, shaftCycleAngleRad);
    driver.applyFacePhases(showCycle ? shaftCycleAngleRad : null);
  }
}

interface EngineRowProps {
  slot: EngineSlot;
  registry: RefObject<MechanismRegistry>;
  proportions: MechanismProportions;
  cylinders: readonly PlacedCylinder[];
}

/**
 * One engine's cylinders, drawn along the crankshaft — one per slot for an
 * inline engine, two sharing a slot for each throw of a V or flat one (§24a).
 * The placement is entirely the layout's; this only unpacks it.
 */
function EngineRow({ slot, registry, proportions, cylinders }: EngineRowProps) {
  return (
    <>
      {cylinders.map((cylinder) => (
        <PlacedCylinderMechanism
          key={cylinder.index}
          slot={slot}
          index={cylinder.index}
          registry={registry}
          proportions={proportions}
          offsetXMm={cylinder.offsetXMm}
          offsetYMm={cylinder.offsetYMm}
          offsetZMm={cylinder.offsetZMm}
          drawnRotationRad={cylinder.drawnRotationRad}
          drawsCrank={cylinder.drawsCrank}
        />
      ))}
    </>
  );
}

interface RotaryRowProps {
  slot: EngineSlot;
  registry: RefObject<MechanismRegistry>;
  proportions: RotaryProportions;
  rotors: readonly PlacedRotor[];
}

/**
 * One rotary engine's rotors, drawn along the eccentric shaft (§27). The
 * placement is entirely the layout's; this only unpacks it.
 */
function RotaryRow({ slot, registry, proportions, rotors }: RotaryRowProps) {
  return (
    <>
      {rotors.map((rotor) => (
        <PlacedRotorMechanism
          key={rotor.index}
          slot={slot}
          index={rotor.index}
          registry={registry}
          proportions={proportions}
          offsetXMm={rotor.offsetXMm}
          offsetYMm={rotor.offsetYMm}
          rotorPhaseRad={rotor.rotorPhaseRad}
        />
      ))}
    </>
  );
}

interface PlacedCylinderMechanismProps {
  slot: EngineSlot;
  index: number;
  registry: RefObject<MechanismRegistry>;
  proportions: MechanismProportions;
  offsetXMm: number;
  /** Crank-center height (§24a); non-zero only for a stacked comparison's engine B. */
  offsetYMm: number;
  /** Depth (§24a); non-zero only for the second cylinder of a throw pair. */
  offsetZMm: number;
  /**
   * How far this cylinder's drawing is rotated about its own crankshaft
   * center (`PlacedCylinder.drawnRotationRad`, §24a) — its real bank tilt
   * unless the single-cylinder view or the "stand flat engines upright"
   * preference overrode it. 0 for inline layouts either way.
   */
  drawnRotationRad: number;
  /** False for the bank-1 cylinder of a shared-pin V pair (§24a). */
  drawsCrank: boolean;
}

/**
 * One cylinder: its own group refs, its own reusable carrier, and its
 * registration with the stage's frame loop.
 *
 * The registration is a layout effect so it is in place before the first
 * painted frame, and its cleanup removes the entry — which is how a cylinder
 * that disappears (comparison switched off, cylinder count reduced) stops
 * being driven without the loop having to know it went away.
 */
function PlacedCylinderMechanism({
  slot,
  index,
  registry,
  proportions,
  offsetXMm,
  offsetYMm,
  offsetZMm,
  drawnRotationRad,
  drawsCrank,
}: PlacedCylinderMechanismProps) {
  const refs = useMechanismRefs();

  // One reusable carrier per cylinder, refilled in place each frame, so the
  // loop allocates nothing (§11).
  const objects = useRef<MechanismObjects>({
    crank: null,
    rod: null,
    piston: null,
  });

  // The chamber this cylinder tints, and the last phase written to it. Refs,
  // not state: the phase changes several times per revolution and a rerender
  // per stroke would be exactly the per-frame React work §11 rules out.
  const chamberRef = useRef<Group>(null);
  const tint = useRef<ChamberTintState>(createChamberTintState());

  useLayoutEffect(() => {
    const mounted = registry.current.cylinders[slot];
    mounted.set(index, {
      applyState: (state: MechanismState) => {
        applyMechanismState(objects.current, refs, state);
      },
      applyPhase: (phase) => {
        applyChamberPhase(chamberRef.current, tint.current, phase);
      },
    });
    return () => {
      mounted.delete(index);
    };
  }, [registry, slot, index, refs]);

  return (
    <CrankMechanism
      p={proportions}
      positionX={offsetXMm}
      positionY={offsetYMm}
      positionZ={offsetZMm}
      drawnRotationRad={drawnRotationRad}
      crankRef={refs.crank}
      rodRef={refs.rod}
      pistonRef={refs.piston}
      chamberRef={chamberRef}
      drawsCrank={drawsCrank}
    />
  );
}

interface PlacedRotorMechanismProps {
  slot: EngineSlot;
  index: number;
  registry: RefObject<MechanismRegistry>;
  proportions: RotaryProportions;
  offsetXMm: number;
  /** Shaft-center height; non-zero only for a stacked comparison's engine B. */
  offsetYMm: number;
  /** This rotor's phase in shaft radians (`PlacedRotor.rotorPhaseRad`). */
  rotorPhaseRad: number;
}

/**
 * One rotor: its own group refs, its own reusable carriers, and its
 * registration with the stage's frame loop (§27).
 *
 * Structurally identical to `PlacedCylinderMechanism`, down to the layout
 * effect that registers before the first painted frame and the cleanup that
 * removes the entry when the rotor disappears — a rotor count reduced from
 * three to two, or a slot switched back to the piston family, then simply
 * stops being driven without the loop having to know it went away.
 *
 * Its `rotorPhaseRad` is closed over in the registered functions rather than
 * passed per frame, exactly as a cylinder's definition is: it is a property of
 * this rotor's place in the engine, not of the frame.
 */
function PlacedRotorMechanism({
  slot,
  index,
  registry,
  proportions,
  offsetXMm,
  offsetYMm,
  rotorPhaseRad,
}: PlacedRotorMechanismProps) {
  const rotorRef = useRef<Group>(null);
  const eccentricRef = useRef<Group>(null);
  // One ref per face, created unconditionally so the hook count is fixed:
  // `ROTOR_FACE_COUNT` is a geometric constant, not a configurable.
  const faceRef0 = useRef<Group>(null);
  const faceRef1 = useRef<Group>(null);
  const faceRef2 = useRef<Group>(null);
  const faceRefs = useMemo(
    () => [faceRef0, faceRef1, faceRef2],
    [faceRef0, faceRef1, faceRef2],
  );

  // Reusable carriers, refilled in place each frame, so the loop allocates
  // nothing (§11, §18).
  const objects = useRef<RotorObjects>({ rotor: null, eccentric: null });
  const placement = useRef<RotorPlacement>(createRotorPlacement());
  const faceGroups = useRef<(Group | null)[]>(
    new Array<Group | null>(ROTOR_FACE_COUNT).fill(null),
  );
  const tint = useRef<RotorFaceTintState>(createRotorFaceTintState());

  useLayoutEffect(() => {
    const mounted = registry.current.rotors[slot];
    mounted.set(index, {
      applyPlacement: (config, shaftCycleAngleRad) => {
        objects.current.rotor = rotorRef.current;
        objects.current.eccentric = eccentricRef.current;
        applyRotorPlacement(
          objects.current,
          computeRotorPlacement(
            config,
            shaftCycleAngleRad,
            rotorPhaseRad,
            placement.current,
          ),
        );
      },
      applyFacePhases: (shaftCycleAngleRad) => {
        for (let k = 0; k < ROTOR_FACE_COUNT; k += 1) {
          faceGroups.current[k] = faceRefs[k].current;
        }
        applyRotorFacePhases(
          faceGroups.current,
          tint.current,
          shaftCycleAngleRad,
          rotorPhaseRad,
        );
      },
    });
    return () => {
      mounted.delete(index);
    };
  }, [registry, slot, index, rotorPhaseRad, faceRefs]);

  return (
    <RotaryMechanism
      p={proportions}
      positionX={offsetXMm}
      positionY={offsetYMm}
      rotorRef={rotorRef}
      eccentricRef={eccentricRef}
      faceRefs={faceRefs}
    />
  );
}
