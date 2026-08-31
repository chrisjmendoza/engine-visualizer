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
 * A layout is identified by an `EngineLayoutId`, not by a cylinder count: a
 * count cannot tell a V8 from an inline-8, or a flat-4 from an inline-4.
 *
 * ## The two angles, and why they must not be folded together
 *
 * Each cylinder carries two independent angles:
 *
 * - **`crankPhaseRad`** — a *crank-throw* phase. Where this cylinder's
 *   crankpin sits relative to cylinder 0's, and the only one of the two that
 *   the kinematics see: the cylinder is driven at
 *   `cylinderCrankAngleRad(θ, cylinder) = θ + crankPhaseRad`.
 * - **`bankOffsetRad`** — a *geometric* rotation of that cylinder's bore axis
 *   away from vertical (`−bankAngle/2` for bank 0, `+bankAngle/2` for bank 1,
 *   0 for inline/single, ±π/2 for flat). Purely a rendering transform: the
 *   renderer rotates the whole drawn mechanism about the crankshaft center by
 *   this angle. The mechanism's internal math never sees it.
 *
 * ## Sign convention: TDC angle vs. crank phase
 *
 * A cylinder is at top dead center when *its own* crank angle is 0, i.e. when
 *
 *     θ + crankPhaseRad ≡ 0   ⟺   θ ≡ −crankPhaseRad   (mod 2π)
 *
 * so `crankPhaseRad` is the **negative** of the crank angle at which that
 * cylinder reaches TDC. Engine literature quotes the other quantity — "cyl 5
 * comes up 120° after cyl 1" — so the tables below are written as TDC angles
 * in degrees (`tdcDeg`, "crank degrees after cylinder 0's TDC", the published
 * convention) and negated once, in `buildLayout`. Read the tables as TDC
 * angles; read `crankPhaseRad` as their negation.
 *
 * ## How the two angles interact on a V or flat engine
 *
 * Rotating a drawn mechanism by `bankOffsetRad = β` moves its crankpin: the
 * pin drawn at local crank angle ψ = θ + φ ends up where an unrotated
 * mechanism would put a pin at ψ − β. Two cylinders therefore share one
 * physical crankpin exactly when `φ − β` agrees between them, so for a
 * bank-0 / bank-1 pair on one pin (β = ∓bankAngle/2):
 *
 *     φ_bank1 = φ_bank0 + bankAngle                      (shared crankpin)
 *
 * A **narrow-angle V** achieves even firing by staggering the pair's pins a
 * further angle s apart, giving `φ_bank1 = φ_bank0 + bankAngle + s`. A small
 * stagger (30°, on a 90° V6) leaves enough pin overlap to cut as a true
 * **split pin** — one journal machined as two overlapping halves — but a 60°
 * stagger (`v6-60`) does not, so those pins are cast as two separate
 * crankpins joined by a **flying arm** instead. A **boxer** does not
 * share pins at all: opposed cylinders sit on separate throws 180° apart,
 * which — with bores 180° apart — works out as `φ_bank1 = φ_bank0`, i.e. the
 * two pistons reach their outer dead centers together (see `flat-4`).
 *
 * Equivalently, in TDC terms: `tdc_bank1 = tdc_bank0 − bankAngle − s`. Every
 * table below satisfies its stated relation, and `engineLayout.test.ts`
 * re-derives the crankpin positions from `crankPhaseRad` + `bankOffsetRad` to
 * prove the shared pins really do coincide (and boxer pins really do not).
 *
 * ## Firing order and firing intervals
 *
 * A crank-throw table alone does not determine a four-stroke engine's firing
 * order: each cylinder reaches TDC twice per 720° cycle and only fires on one
 * of them, and which one is a camshaft decision, not a crank decision. Each
 * layout therefore also carries `firingOrder` — the real engine's published
 * order, expressed as cylinder indices — and `firingSequenceRad` walks it to
 * recover the actual firing angles over 720°: each cylinder fires at the first
 * occurrence of its own TDC angle after the previous cylinder fired. That is
 * what makes the interval pattern (even 720/N, or the odd-fire 90°/150°
 * alternation of `v6-90-odd`) a derived, testable consequence of the table
 * rather than a comment.
 *
 * ## Cylinder ordering
 *
 * `index` runs front to back along the crankshaft. For V and flat layouts the
 * indices alternate banks — even indices on bank 0, odd on bank 1 — so index
 * 2k and 2k+1 are the pair on throw k. The renderer relies on that pairing: it
 * draws both cylinders of a pair around one crank center, in one cutaway plane
 * (§24a), so a V8 reads as four V-shaped units rather than eight separate
 * mechanisms. Whether that plane gets one drawn crank or two is decided by
 * `sharesCrankpin` below, not by the layout kind.
 */

import { normalizeAngleRad } from "./units";

export type EngineLayoutKind = "single" | "inline" | "v" | "flat";

/**
 * Every layout with a defined crank-throw phase table (see below).
 *
 * `"single"` is a **legacy** member (§24a, second amendment). It predates the
 * split between "which engine is this" (`layoutId`) and "how much of it am I
 * looking at" (`singleCylinderView`), and it conflated the two. It is kept
 * here so old share links (`l=single`, `c=1`) still decode and so
 * `createEngineLayout("single")` keeps working, but nothing in the running
 * application selects or stores it any more: the picker offers
 * `ENGINE_ARCHITECTURE_IDS`, and looking at one cylinder is now the view
 * preference, whatever the architecture.
 */
export const ENGINE_LAYOUT_IDS = [
  "single",
  "inline-3",
  "inline-4",
  "inline-5",
  "inline-6",
  "v6-60",
  "v6-90-odd",
  "v8-cross",
  "v8-flat",
  "v10-72",
  "v12-60",
  "flat-4",
  "flat-6",
] as const;

export type EngineLayoutId = (typeof ENGINE_LAYOUT_IDS)[number];

/**
 * The layout the application starts on, and the one a link implies for a
 * configuration that matches no preset. An inline-4 is the most common engine
 * there is, and — opened in the default single-cylinder view — it draws
 * exactly the one cylinder the app has always opened with.
 */
export const DEFAULT_LAYOUT_ID: EngineLayoutId = "inline-4";

/** One cylinder's position and phase within an engine's layout. */
export interface CylinderDefinition {
  /** 0-based position along the crankshaft, front to back. */
  index: number;
  /** Bank the cylinder belongs to: 0 or 1 (always 0 for single/inline). */
  bankIndex: number;
  /** This cylinder's crank-throw offset from cylinder 0's throw, radians in [0, 2π). */
  crankPhaseRad: number;
  /**
   * Signed rotation of this cylinder's bore axis away from vertical, radians:
   * `−bankAngleRad/2` on bank 0, `+bankAngleRad/2` on bank 1. Geometry for
   * the renderer only — never mixed into `crankPhaseRad` (see the header).
   */
  bankOffsetRad: number;
}

/** A complete engine layout: how many cylinders, and how their throws relate. */
export interface EngineLayoutDefinition {
  id: EngineLayoutId;
  kind: EngineLayoutKind;
  /** Human-readable name, e.g. "V8 (cross-plane)". */
  label: string;
  /** Angle between banks, radians. 0 for single and inline layouts. */
  bankAngleRad: number;
  cylinders: readonly CylinderDefinition[];
  /**
   * The engine's firing order as cylinder indices, starting at cylinder 0.
   * Real published data, not derived: see the header's note on why a crank
   * table cannot imply it.
   */
  firingOrder: readonly number[];
}

/** Full crank cycle of a four-stroke engine: two revolutions. */
const FOUR_STROKE_CYCLE_RAD = 4 * Math.PI;

const DEG_TO_RAD = Math.PI / 180;

interface LayoutSpec {
  kind: EngineLayoutKind;
  label: string;
  /** Angle between the banks, degrees (0 for single/inline, 180 for flat). */
  bankAngleDeg: number;
  /**
   * Crank angle at which each cylinder reaches TDC, in degrees after cylinder
   * 0's TDC, indexed front to back along the crank. Negated into
   * `crankPhaseRad` by `buildLayout` (see the header's sign convention).
   */
  tdcDeg: readonly number[];
  /** Cylinder indices in firing order, starting at cylinder 0. */
  firingOrder: readonly number[];
}

/**
 * Crank-throw tables, as TDC angles in degrees, with the derivation of each
 * spelled out. Cylinder 0's TDC (and therefore its phase) is always 0, so the
 * existing readouts, degree counter, and scrubbing stay referenced to cylinder
 * 1 whatever the layout.
 *
 * A note on published firing orders: which of two cylinders on a shared pin
 * leads the other depends on the crank's rotation sense, and the drawn crank
 * here turns clockwise (see `sceneGeometry.ts`). Where the sequence below is
 * the reverse of a manufacturer's published order, that is the same crank read
 * against the drawn rotation sense — the intervals, the bank alternation, and
 * the pin sharing are identical — and it is called out in that layout's note.
 */
const LAYOUT_SPECS: Record<EngineLayoutId, LayoutSpec> = {
  /**
   * One cylinder: fires once per 720°, so the "interval" is the whole cycle.
   */
  single: {
    kind: "single",
    label: "Single cylinder",
    bankAngleDeg: 0,
    tdcDeg: [0],
    firingOrder: [0],
  },

  /**
   * Inline-3, 120° crank. Three throws 120° apart, so TDCs land at 0°, 120°,
   * 240°; firing order 1-3-2 (the usual triple order, e.g. Ford EcoBoost) puts
   * the firings at 0°, 240°, 480° — even fire every 240° = 720/3.
   */
  "inline-3": {
    kind: "inline",
    label: "Inline-3",
    bankAngleDeg: 0,
    tdcDeg: [0, 120, 240],
    firingOrder: [0, 2, 1],
  },

  /**
   * Inline-4, flat-plane crank: throws paired 1&4 up, 2&3 down, so TDCs are
   * 0°, 180°, 180°, 0°. Firing order 1-3-4-2 fires at 0°, 180°, 360°, 540° —
   * even fire every 180° = 720/4. Two cylinders share each TDC angle; the
   * pair simply fires in different revolutions of the cycle.
   */
  "inline-4": {
    kind: "inline",
    label: "Inline-4",
    bankAngleDeg: 0,
    tdcDeg: [0, 180, 180, 0],
    firingOrder: [0, 2, 3, 1],
  },

  /**
   * Inline-5, 72° crank (Audi/VW, Volvo). Five throws at 72° spacing and the
   * classic 1-2-4-5-3 firing order: firings at 0°, 144°, 288°, 432°, 576° —
   * even fire every 144° = 720/5. Reducing those firing angles mod 360 gives
   * the TDC table below (cyl 5 fires at 432°, so its TDC is 72°), which is
   * exactly "five throws, each a distinct multiple of 72°".
   */
  "inline-5": {
    kind: "inline",
    label: "Inline-5",
    bankAngleDeg: 0,
    tdcDeg: [0, 144, 216, 288, 72],
    firingOrder: [0, 1, 3, 4, 2],
  },

  /**
   * Inline-6, 120° crank with throws paired 1&6, 2&5, 3&4 — the perfectly
   * balanced arrangement. Firing order 1-5-3-6-2-4 (BMW, Toyota, Nissan RB)
   * fires at 0°, 120°, ..., 600°: even fire every 120° = 720/6. Working those
   * back mod 360 pairs the TDCs as 1&6 at 0°, 2&5 at 120°, 3&4 at 240°.
   */
  "inline-6": {
    kind: "inline",
    label: "Inline-6",
    bankAngleDeg: 0,
    tdcDeg: [0, 120, 240, 240, 120, 0],
    firingOrder: [0, 4, 2, 5, 1, 3],
  },

  /**
   * 60° V6, even-fire — the VR38DETT's layout.
   *
   * A 60° V6 on plain shared pins is *not* even-fire: three throws 120° apart
   * put the bank-0 TDCs at 0°/120°/240° and each bank-1 partner 60° earlier,
   * i.e. at six distinct angles 60° apart, which cannot be spread evenly over
   * 720°. The fix is **separate crankpins joined by a flying arm**: each
   * cylinder gets its own pin rather than sharing one with its bank partner,
   * and the pair's pins are offset a further 60° apart (too little overlap
   * for a true split pin, which is why a flying-arm web — not a split
   * journal — carries the load here), making the effective bank-to-bank
   * throw separation 60° + 60° = 120° (`tdc_bank1 = tdc_bank0 − 120°`). Then
   * every TDC angle is one of 0°/120°/240°, each shared by exactly two
   * cylinders, and the engine fires evenly every 120° = 720/6.
   *
   * Firing order 1-6-5-4-3-2 in the conventional V6 numbering (bank 0 = cyl
   * 1,3,5 = even indices; bank 1 = cyl 2,4,6 = odd indices), as used by GM's
   * even-fire V6s. It alternates banks on every firing.
   */
  "v6-60": {
    kind: "v",
    label: "V6 (60°)",
    bankAngleDeg: 60,
    tdcDeg: [0, 240, 120, 0, 240, 120],
    firingOrder: [0, 5, 4, 3, 2, 1],
  },

  /**
   * 90° V6, **odd-fire** — the classic Buick 198/225/231 layout, and the one
   * case here whose unevenness is the point.
   *
   * Three shared crankpins 120° apart, no split journals, in a 90° vee. Bank-0
   * TDCs at 0°/120°/240°; each bank-1 partner sits on the same pin, so its TDC
   * is 90° earlier: 270°/30°/150°. That gives six distinct TDC angles in a
   * 30-90-30-90-30-90 pattern around the circle, which no assignment of
   * revolutions can spread evenly over 720°.
   *
   * With the real 1-6-5-4-3-2 firing order the firings land at 0°, 150°, 240°,
   * 390°, 480°, 630°, i.e. intervals of **150°, 90°, 150°, 90°, 150°, 90°** —
   * the lumpy odd-fire beat these engines are known for. This must never be
   * "rounded" to an even 120°: doing so would silently turn it into a
   * different (split-pin) engine.
   */
  "v6-90-odd": {
    kind: "v",
    label: "V6 (90°, odd-fire)",
    bankAngleDeg: 90,
    tdcDeg: [0, 270, 120, 30, 240, 150],
    firingOrder: [0, 5, 4, 3, 2, 1],
  },

  /**
   * Cross-plane V8 (Chevrolet LS3/LS7 and every American V8 with the burble).
   *
   * Four crankpins at 90° spacing — two perpendicular planes, hence
   * "cross-plane" — each shared by one cylinder per bank in a 90° vee. Shared
   * pin + 90° vee means `tdc_bank1 = tdc_bank0 − 90°`, so both banks' TDCs
   * fall on the same 0/90/180/270 grid and each of those four angles carries
   * exactly two cylinders: even fire every 90° = 720/8.
   *
   * GM's own firing order 1-8-7-2-6-5-4-3 (indices 0,7,6,1,5,4,3,2 here, since
   * GM numbers cyl 1,3,5,7 down one bank and 2,4,6,8 down the other, which is
   * this module's alternating index order) reproduces exactly that: firings at
   * 0°, 90°, ..., 630°. Reducing them mod 360 gives the table below, whose
   * bank-0 throws sit at 0°, 270°, 90°, 180° — four throws 90° apart.
   *
   * The uneven *per bank* firing (one bank fires at 90°/180°/270°/180°
   * intervals rather than evenly) is what gives a cross-plane V8 its
   * characteristic exhaust note, even though the engine as a whole is
   * even-fire; the flat-plane V8 below is the contrast.
   */
  "v8-cross": {
    kind: "v",
    label: "V8 (cross-plane)",
    bankAngleDeg: 90,
    tdcDeg: [0, 270, 270, 180, 90, 0, 180, 90],
    firingOrder: [0, 7, 6, 1, 5, 4, 3, 2],
  },

  /**
   * Flat-plane V8 (Ferrari 458's F136 FB) — the pedagogically interesting one.
   *
   * The crank is a single plane, exactly like an inline-4's: four throws at
   * 0°/180°/180°/0°. Each is still shared by one cylinder per bank in a 90°
   * vee, so `tdc_bank1 = tdc_bank0 − 90°` and the bank-1 TDCs land at
   * 270°/90°/90°/270°.
   *
   * **The engine is still even-fire at 90°** — that is the point most often
   * gotten wrong. The eight TDC angles are 0/90/180/270, each carrying two
   * cylinders, exactly as for the cross-plane crank, so the *whole engine*
   * fires every 90° in both cases. What differs is the per-bank pattern: here
   * the banks alternate on every single firing, so each bank fires evenly
   * every 180° on its own (like two inline-4s), whereas the cross-plane crank
   * makes each bank fire unevenly. The famous flat-plane wail comes from that
   * even per-bank spacing and the lighter, counterweight-free crank — not from
   * uneven firing intervals.
   *
   * Firing order: 1-6-2-8-4-7-3-5 in Ferrari's numbering (cyl 1-4 down bank 0,
   * 5-8 down bank 1; index 2k = Ferrari cyl k+1, index 2k+1 = Ferrari cyl
   * k+5). That is Ferrari's published 1-5-3-7-4-8-2-6 read against the drawn
   * rotation sense — see the note above `LAYOUT_SPECS`.
   */
  "v8-flat": {
    kind: "v",
    label: "V8 (flat-plane)",
    bankAngleDeg: 90,
    tdcDeg: [0, 270, 180, 90, 180, 90, 0, 270],
    firingOrder: [0, 3, 2, 7, 6, 5, 4, 1],
  },

  /**
   * 72° V10 — the bank angle that makes a V10 even-fire without split pins
   * (BMW's S85 and the 72° Formula 1 V10s).
   *
   * Five shared crankpins on a 72° "star" (all TDCs a multiple of 72°) in a
   * 72° vee: `tdc_bank1 = tdc_bank0 − 72°` keeps both banks on the same 72°
   * grid, so each of the five angles carries two cylinders and the engine
   * fires every 720/10 = 72°. Bank 0 uses the inline-5 throw arrangement
   * above; the firing sequence alternates banks on every firing, which the
   * even 72° grid forces.
   */
  "v10-72": {
    kind: "v",
    label: "V10 (72°)",
    bankAngleDeg: 72,
    tdcDeg: [0, 288, 144, 72, 216, 144, 288, 216, 72, 0],
    firingOrder: [0, 3, 2, 7, 6, 9, 8, 5, 4, 1],
  },

  /**
   * 60° V12 — two inline-6s on a common crank (Ferrari, Lamborghini, Jaguar).
   *
   * Six shared crankpins in the inline-6 arrangement (0/120/240 paired front
   * to back) in a 60° vee: `tdc_bank1 = tdc_bank0 − 60°` fills in the odd
   * multiples of 60°, giving six TDC angles 60° apart, each carrying two
   * cylinders. Firing interval 720/12 = 60°, banks alternating — which is
   * exactly why 60° is *the* V12 angle: an inline-6 is already perfectly
   * balanced and even-fire, and 60° interleaves the second one perfectly.
   */
  "v12-60": {
    kind: "v",
    label: "V12 (60°)",
    bankAngleDeg: 60,
    tdcDeg: [0, 300, 120, 60, 240, 180, 240, 180, 120, 60, 0, 300],
    firingOrder: [0, 3, 8, 5, 4, 1, 10, 9, 2, 7, 6, 11],
  },

  /**
   * Flat-4 **boxer** (Subaru EJ/FA, VW/Porsche air-cooled) — not a 180° V.
   *
   * The distinction is in the crankpins, and it is the whole difference: a
   * boxer gives every cylinder its own throw, with the opposed pair's throws
   * 180° apart, so the opposed pistons move *outward together* (both at their
   * outer dead center at the same crank angle — hence equal `crankPhaseRad`
   * despite bores pointing opposite ways). A 180° V shares one pin between the
   * opposed pair, so those pistons move in the *same* direction, one out while
   * the other is in, and the phases would differ by 180°. Only the boxer is
   * modeled here.
   *
   * Two throw pairs 180° apart give TDCs 0°, 0°, 180°, 180°; Subaru's 1-3-2-4
   * firing order (cyl 1&2 the front opposed pair, 3&4 the rear) fires at 0°,
   * 180°, 360°, 540° — even fire every 180° = 720/4.
   */
  "flat-4": {
    kind: "flat",
    label: "Flat-4 (boxer)",
    bankAngleDeg: 180,
    tdcDeg: [0, 0, 180, 180],
    firingOrder: [0, 2, 1, 3],
  },

  /**
   * Flat-6 boxer (Porsche 911). Same opposed-throw principle as the flat-4:
   * each cylinder has its own pin, each opposed pair's throws are 180° apart,
   * so paired cylinders share a TDC angle. Three throw pairs 120° apart give
   * TDCs 0°, 0°, 240°, 240°, 120°, 120° (indices alternating banks, so the
   * pairs are 0&1, 2&3, 4&5), and Porsche's 1-6-2-4-3-5 firing order fires at
   * 0°, 120°, ..., 600° — even fire every 120° = 720/6.
   */
  "flat-6": {
    kind: "flat",
    label: "Flat-6 (boxer)",
    bankAngleDeg: 180,
    tdcDeg: [0, 0, 240, 240, 120, 120],
    firingOrder: [0, 5, 2, 1, 4, 3],
  },
};

/**
 * Turns one spec into a frozen layout.
 *
 * Phases are negated TDC angles (see the header) and the negation is done in
 * *degrees*, so a 0° TDC yields exactly +0 rather than −0, and every phase is
 * an exact multiple of a degree before the single conversion to radians.
 */
function buildLayout(
  id: EngineLayoutId,
  spec: LayoutSpec,
): EngineLayoutDefinition {
  const bankAngleRad = spec.bankAngleDeg * DEG_TO_RAD;
  const banked = spec.kind === "v" || spec.kind === "flat";

  const cylinders: CylinderDefinition[] = spec.tdcDeg.map((tdcDeg, index) => {
    const bankIndex = banked ? index % 2 : 0;
    return {
      index,
      bankIndex,
      crankPhaseRad: ((360 - tdcDeg) % 360) * DEG_TO_RAD,
      bankOffsetRad: banked
        ? (bankIndex === 0 ? -1 : 1) * (bankAngleRad / 2)
        : 0,
    };
  });

  return Object.freeze({
    id,
    kind: spec.kind,
    label: spec.label,
    bankAngleRad,
    cylinders: Object.freeze(cylinders),
    firingOrder: Object.freeze([...spec.firingOrder]),
  });
}

/**
 * Builds and freezes every layout once, so `createEngineLayout` can return a
 * shared immutable instance instead of rebuilding one on every call —
 * important since callers include per-frame rendering code that must never
 * allocate a fresh layout per frame.
 */
const LAYOUT_CACHE: Record<EngineLayoutId, EngineLayoutDefinition> =
  Object.fromEntries(
    ENGINE_LAYOUT_IDS.map((id) => [id, buildLayout(id, LAYOUT_SPECS[id])]),
  ) as Record<EngineLayoutId, EngineLayoutDefinition>;

/**
 * The architectures a user can actually choose — the roster minus the legacy
 * `"single"` (see `ENGINE_LAYOUT_IDS`). "One cylinder" is no longer an engine
 * architecture but a way of *viewing* one, so the picker lists real engines
 * only and `singleCylinderView` decides how many of their cylinders are drawn.
 *
 * Derived by filtering on `kind` rather than listed by hand, so a future
 * layout is offered the moment it joins the roster.
 */
export const ENGINE_ARCHITECTURE_IDS: readonly EngineLayoutId[] = Object.freeze(
  ENGINE_LAYOUT_IDS.filter((id) => LAYOUT_CACHE[id].kind !== "single"),
);

/**
 * Just cylinder 0 of each layout, built once and frozen alongside the layouts
 * themselves so `visibleCylinders` can return a shared array instead of
 * slicing a fresh one per call — the same no-allocation discipline
 * `createEngineLayout` follows, since scene code holds these across frames.
 */
const FIRST_CYLINDER_CACHE: Record<
  EngineLayoutId,
  readonly CylinderDefinition[]
> = Object.fromEntries(
  ENGINE_LAYOUT_IDS.map((id) => [
    id,
    Object.freeze([LAYOUT_CACHE[id].cylinders[0] as CylinderDefinition]),
  ]),
) as Record<EngineLayoutId, readonly CylinderDefinition[]>;

/**
 * Returns the layout for a layout id. The result is a shared, frozen instance
 * — treat it as immutable and safe to hold across frames rather than
 * recomputing.
 */
export function createEngineLayout(id: EngineLayoutId): EngineLayoutDefinition {
  return LAYOUT_CACHE[id];
}

/**
 * The cylinders actually on stage, given the view preference (§24a): every
 * cylinder of the engine, or just cylinder 0 while the single-cylinder view is
 * on.
 *
 * This is the **one** place that decision is made. The scene, the displacement
 * multiplier in the results, and anything else that counts cylinders all go
 * through this (or `visibleCylinderCount`) rather than re-deriving it, so
 * "which cylinders are visible" can never mean two different things in two
 * places. Note that the architecture itself is untouched: a V8 viewed as one
 * cylinder is still a V8 — its cylinder 0 keeps the bank tilt and zero phase
 * it has in the full engine.
 */
export function visibleCylinders(
  layout: EngineLayoutDefinition,
  singleCylinderView: boolean,
): readonly CylinderDefinition[] {
  return singleCylinderView
    ? FIRST_CYLINDER_CACHE[layout.id]
    : layout.cylinders;
}

/** How many cylinders `visibleCylinders` would return, without the array. */
export function visibleCylinderCount(
  layout: EngineLayoutDefinition,
  singleCylinderView: boolean,
): number {
  return singleCylinderView ? 1 : layout.cylinders.length;
}

/**
 * Type guard for untrusted values (share links, UI selects) — true only for a
 * layout this module has a phase table for.
 */
export function isEngineLayoutId(value: unknown): value is EngineLayoutId {
  return (
    typeof value === "string" &&
    (ENGINE_LAYOUT_IDS as readonly string[]).includes(value)
  );
}

/**
 * A cylinder's instantaneous crank angle: the engine's shared crank angle
 * plus this cylinder's throw offset, normalized to [0, 2π) so callers that
 * compare or wrap angles (e.g. `calculateMechanismState` via a caller that
 * cares about angle-wrap equivalence) see a consistent range.
 *
 * `bankOffsetRad` deliberately plays no part: it rotates how the mechanism is
 * drawn, not when its piston reaches TDC.
 */
export function cylinderCrankAngleRad(
  globalCrankAngleRad: number,
  cylinder: CylinderDefinition,
): number {
  return normalizeAngleRad(globalCrankAngleRad + cylinder.crankPhaseRad);
}

/**
 * Angular tolerance for the pin-coincidence test below. The tables are written
 * in whole degrees and converted once, so two cylinders that share a pin agree
 * to within a few ulps (measured: ≤ 5e-16 rad across the whole roster), while
 * the smallest split that any real layout uses is 60° — nine orders of
 * magnitude clear of this bound either way.
 */
const CRANKPIN_TOLERANCE_RAD = 1e-9;

/**
 * Whether two cylinders ride the **same physical crankpin**.
 *
 * Rotating a drawn mechanism by `β = bankOffsetRad` puts its crankpin where an
 * unrotated one would draw local crank angle `ψ − β`, so a cylinder's pin sits,
 * in world terms, at direction `β − θ − crankPhaseRad` from +Y at every engine
 * angle θ. Two cylinders' pins therefore coincide at *every* crank angle
 * exactly when `crankPhaseRad − bankOffsetRad` agrees between them — a
 * θ-independent property of the layout, which is why this takes no angle.
 *
 * The three cases across the roster, all of them consequences of the tables
 * rather than assumptions about them:
 *
 * - **Plain-pin V** (`v6-90-odd`, both V8s, `v10-72`, `v12-60`): the bank-1
 *   partner's phase leads by exactly the bank angle, which cancels the bank
 *   offset — the pair shares one pin, as a real V does.
 * - **Flying-arm V** (`v6-60`): each cylinder has its own crankpin rather
 *   than sharing one with its bank partner; the pair's pins are offset a
 *   further 60° apart (too little overlap for a true split pin, hence the
 *   flying-arm web) and both are real. A renderer that assumed every V
 *   shares pins would draw this engine wrong.
 * - **Boxer** (`flat-4`, `flat-6`): equal phases with bores 180° apart put the
 *   pins antipodal — separate throws, which is exactly why opposed pistons
 *   move outward together.
 */
export function sharesCrankpin(
  a: CylinderDefinition,
  b: CylinderDefinition,
): boolean {
  const delta =
    a.crankPhaseRad - a.bankOffsetRad - (b.crankPhaseRad - b.bankOffsetRad);
  // Signed wrap into (−π, π], so a difference of exactly 2π reads as zero.
  const wrapped = Math.atan2(Math.sin(delta), Math.cos(delta));
  return Math.abs(wrapped) < CRANKPIN_TOLERANCE_RAD;
}

/**
 * The engine crank angle, in [0, 2π), at which this cylinder reaches top dead
 * center — the negation of its crank phase (see the header's sign note).
 */
export function cylinderTdcAngleRad(cylinder: CylinderDefinition): number {
  const tdc = normalizeAngleRad(-cylinder.crankPhaseRad);
  // Negating a zero phase yields -0, which is numerically equal to 0 but not
  // identical to it; cylinder 0's TDC should read as a plain 0.
  return tdc === 0 ? 0 : tdc;
}

/** One cylinder's power stroke within the 720° cycle. */
export interface FiringEvent {
  /** Index of the cylinder that fires. */
  index: number;
  /** Crank angle of that firing, radians in [0, 4π), measured from cylinder 0's. */
  crankAngleRad: number;
}

/**
 * Walks a layout's firing order into actual firing angles over one 720°
 * four-stroke cycle.
 *
 * Cylinder 0 fires at 0 (its TDC, by construction). Each subsequent cylinder
 * in `firingOrder` fires at the first occurrence of *its* TDC angle strictly
 * after the previous firing — a cylinder reaches TDC twice per cycle, and the
 * one it fires on is the one that keeps the sequence moving forward. The
 * result is the firing interval pattern: even at 720/N for every layout here
 * except `v6-90-odd`, which alternates 150°/90°.
 */
export function firingSequenceRad(
  layout: EngineLayoutDefinition,
): readonly FiringEvent[] {
  const events: FiringEvent[] = [];
  let previous = 0;

  layout.firingOrder.forEach((index, position) => {
    const cylinder = layout.cylinders[index] as CylinderDefinition;
    // First occurrence of this cylinder's TDC angle strictly after the
    // previous firing, so the sequence advances monotonically. A firing order
    // that did not fit its crank table would run past 4π here rather than
    // silently folding back — which is what the interval tests check.
    let crankAngleRad = cylinderTdcAngleRad(cylinder);
    while (position > 0 && crankAngleRad <= previous) {
      crankAngleRad += 2 * Math.PI;
    }
    events.push({ index, crankAngleRad });
    previous = crankAngleRad;
  });

  return events;
}

/**
 * The gaps between consecutive firings over one 720° cycle, including the
 * wrap from the last firing back to cylinder 0's next one. Always sums to 4π.
 */
export function firingIntervalsRad(
  layout: EngineLayoutDefinition,
): readonly number[] {
  const events = firingSequenceRad(layout);
  return events.map((event, i) =>
    i + 1 < events.length
      ? (events[i + 1] as FiringEvent).crankAngleRad - event.crankAngleRad
      : FOUR_STROKE_CYCLE_RAD - event.crankAngleRad,
  );
}

/**
 * `firingSequenceRad` re-indexed **by cylinder index** instead of by position
 * in the firing order, built once per layout and frozen.
 *
 * The sequence answers "who fires next"; per-cylinder consumers ask the
 * transposed question — "how far into the 720° cycle does *this* cylinder
 * fire" — and one of them (`cylinderStrokePhaseAt`, driving the scene's tint)
 * asks it for every cylinder on every frame. Walking the firing order to find
 * out would allocate an events array per frame, which §18 forbids, so the walk
 * happens once at module load and the answer is a shared frozen lookup, exactly
 * like `LAYOUT_CACHE` itself.
 *
 * Cylinder 0's entry is always 0: it is the cylinder the firing order starts
 * from, by construction.
 */
const FIRING_ANGLE_CACHE: Record<EngineLayoutId, readonly number[]> =
  Object.fromEntries(
    ENGINE_LAYOUT_IDS.map((id) => {
      const layout = LAYOUT_CACHE[id];
      const angles = new Array<number>(layout.cylinders.length).fill(0);
      for (const event of firingSequenceRad(layout)) {
        angles[event.index] = event.crankAngleRad;
      }
      return [id, Object.freeze(angles)];
    }),
  ) as Record<EngineLayoutId, readonly number[]>;

/**
 * The crank angle, in [0, 4π), at which one cylinder fires within the engine's
 * 720° cycle — measured from cylinder 0's own firing, which is 0.
 *
 * This is real engine data, not a rendering convenience: it comes from the
 * layout's published `firingOrder` walked against its crank table (see
 * `firingSequenceRad`), and it is the *only* thing that can say which of a
 * cylinder's two TDCs per cycle is the firing one. Two cylinders can share a
 * crank phase and still be a full revolution apart in the cycle, so no amount
 * of `crankPhaseRad` arithmetic substitutes for it.
 *
 * An index outside the layout falls back to 0 — cylinder 0's own firing angle
 * — rather than returning `undefined` into arithmetic; callers index by a
 * cylinder that came from the layout, so this is a floor, not a feature.
 */
export function cylinderFiringAngleRad(
  layout: EngineLayoutDefinition,
  cylinderIndex: number,
): number {
  const angles = FIRING_ANGLE_CACHE[layout.id];
  return cylinderIndex >= 0 && cylinderIndex < angles.length
    ? (angles[cylinderIndex] as number)
    : 0;
}
