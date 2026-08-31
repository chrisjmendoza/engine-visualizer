import { describe, expect, it } from "vitest";
import {
  decodeConfig,
  decodeShareState,
  defaultLayoutIdFor,
  encodeConfig,
  encodeShareState,
} from "../engine/shareLink";
import type { ShareState } from "../engine/shareLink";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../engine/constants";
import {
  DEFAULT_LAYOUT_ID,
  ENGINE_ARCHITECTURE_IDS,
} from "../engine/engineLayout";
import { ENGINE_PRESETS } from "../engine/presets";
import type { CrankMechanismConfig } from "../engine/types";

const CUSTOM: CrankMechanismConfig = {
  boreMm: 91.5,
  strokeMm: 77.25,
  rodLengthMm: 138,
  compressionRatio: 12.25,
  redlineRpm: 8250,
};

function baseState(overrides: Partial<ShareState> = {}): ShareState {
  return {
    config: DEFAULT_CONFIG,
    comparisonConfig: null,
    layoutId: DEFAULT_LAYOUT_ID,
    comparisonLayoutId: DEFAULT_LAYOUT_ID,
    // The app's own defaults: the default architecture, one cylinder of it.
    singleCylinderView: true,
    comparisonSingleCylinderView: true,
    rpm: DEFAULT_ANIMATION.rpm,
    comparisonRpm: DEFAULT_ANIMATION.rpm,
    rpmLinked: true,
    displayUnit: "mm",
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    isPlaying: true,
    crankAngleRad: 0,
    comparisonCrankAngleRad: 0,
    ...overrides,
  };
}

const LS7 = ENGINE_PRESETS.find((p) => p.id === "corvette-z06-c6-ls7")!.config;
const F20C = ENGINE_PRESETS.find((p) => p.id === "s2000-ap1")!.config;

describe("encodeConfig / decodeConfig", () => {
  it("writes a preset as its id", () => {
    const s2000 = ENGINE_PRESETS.find((p) => p.id === "s2000-ap1");
    expect(s2000).toBeDefined();
    expect(encodeConfig(s2000!.config)).toBe("s2000-ap1");
  });

  it("writes a non-preset config as five hyphen-separated numbers", () => {
    expect(encodeConfig(CUSTOM)).toBe("91.5-77.25-138-12.25-8250");
  });

  it("round-trips every preset", () => {
    for (const preset of ENGINE_PRESETS) {
      expect(decodeConfig(encodeConfig(preset.config))).toEqual(preset.config);
    }
  });

  it("round-trips a custom config", () => {
    expect(decodeConfig(encodeConfig(CUSTOM))).toEqual(CUSTOM);
  });

  it("rejects an unknown preset id", () => {
    expect(decodeConfig("delorean-flux-capacitor")).toBeNull();
  });

  it("rejects malformed numeric configs", () => {
    expect(decodeConfig("86-86-143")).toBeNull();
    expect(decodeConfig("86-86-143-10.5-7000-1")).toBeNull();
    expect(decodeConfig("")).toBeNull();
    expect(decodeConfig("   ")).toBeNull();
  });

  it("rejects numerically valid but mechanically invalid geometry", () => {
    // Rod length below the crank radius: validateConfig must reject it, so a
    // hand-edited link can never push impossible geometry into the scene.
    expect(decodeConfig("86-86-30-10.5-7000")).toBeNull();
    // Compression ratio outside the practical range.
    expect(decodeConfig("86-86-143-99-7000")).toBeNull();
  });
});

describe("encodeShareState", () => {
  it("omits every value that is at its default", () => {
    expect(encodeShareState(baseState())).toBe("a=86-86-143-10.5-7000");
  });

  it("includes engine B when comparing, by preset id", () => {
    const ls7 = ENGINE_PRESETS.find((p) => p.id === "corvette-z06-c6-ls7");
    const f20c = ENGINE_PRESETS.find((p) => p.id === "s2000-ap1");
    // Both layouts match what their preset ids already imply (§24a), so
    // `l`/`bl` stay omitted here — this test is about the `a`/`b` preset-id
    // encoding, not the layout rules covered separately below.
    const query = encodeShareState(
      baseState({
        config: f20c!.config,
        comparisonConfig: ls7!.config,
        layoutId: "inline-4",
        comparisonLayoutId: "v8-cross",
      }),
    );
    expect(query).toBe("a=s2000-ap1&b=corvette-z06-c6-ls7");
  });

  it("includes non-default rpm, unit, and playback speed", () => {
    const query = encodeShareState(
      baseState({ rpm: 4500, displayUnit: "in", playbackSpeed: 0.02 }),
    );
    expect(query).toContain("rpm=4500");
    expect(query).toContain("u=in");
    expect(query).toContain("sp=0.02");
  });

  it("includes the crank angle only when paused", () => {
    expect(
      encodeShareState(baseState({ crankAngleRad: Math.PI })),
    ).not.toContain("angle");
    const paused = encodeShareState(
      baseState({ isPlaying: false, crankAngleRad: Math.PI }),
    );
    expect(paused).toContain("angle=180");
  });

  it("stays readable — no percent-encoding in a typical shared link", () => {
    const query = encodeShareState(
      baseState({
        config: ENGINE_PRESETS[0]!.config,
        comparisonConfig: CUSTOM,
        rpm: 3000,
      }),
    );
    expect(query).not.toContain("%");
  });
});

describe("independent engine speeds", () => {
  it("omits engine B's speed while the engines are linked", () => {
    const query = encodeShareState(
      baseState({
        config: F20C,
        comparisonConfig: LS7,
        rpm: 5000,
        comparisonRpm: 3000,
        rpmLinked: true,
      }),
    );
    expect(query).not.toContain("brpm");
  });

  it("carries engine B's speed when unlinked", () => {
    const query = encodeShareState(
      baseState({
        config: F20C,
        comparisonConfig: LS7,
        rpm: 9000,
        comparisonRpm: 7000,
        rpmLinked: false,
      }),
    );
    expect(query).toContain("rpm=9000");
    expect(query).toContain("brpm=7000");
  });

  it("carries engine B's speed even when it equals engine A's", () => {
    // Presence of `brpm` is what signals "unlinked", so it must travel even
    // when the two speeds coincide.
    const query = encodeShareState(
      baseState({
        config: F20C,
        comparisonConfig: LS7,
        rpm: 4000,
        comparisonRpm: 4000,
        rpmLinked: false,
      }),
    );
    expect(query).toContain("brpm=4000");
  });

  it("omits engine B's speed when not comparing at all", () => {
    const query = encodeShareState(
      baseState({ comparisonConfig: null, rpmLinked: false }),
    );
    expect(query).not.toContain("brpm");
  });

  it("reading a link with brpm unlinks the engines", () => {
    const state = decodeShareState(
      "?a=s2000-ap1&b=corvette-z06-c6-ls7&brpm=7000",
    );
    expect(state.rpmLinked).toBe(false);
    expect(state.comparisonRpm).toBe(7000);
  });

  it("says nothing about linking when brpm is absent", () => {
    const state = decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7");
    expect(state.rpmLinked).toBeUndefined();
    expect(state.comparisonRpm).toBeUndefined();
  });

  it("ignores brpm and bangle when the link carries no usable engine B", () => {
    // Hand-edited: brpm with no b at all, and brpm with an invalid b.
    // Neither may leave a future comparison silently pre-unlinked.
    const noB = decodeShareState("?a=s2000-ap1&brpm=7000&bangle=90");
    expect(noB.rpmLinked).toBeUndefined();
    expect(noB.comparisonRpm).toBeUndefined();
    expect(noB.comparisonCrankAngleRad).toBeUndefined();

    const badB = decodeShareState("?a=s2000-ap1&b=not-real&brpm=7000");
    expect(badB.rpmLinked).toBeUndefined();
    expect(badB.comparisonRpm).toBeUndefined();
  });

  it("ignores an out-of-range or malformed brpm without unlinking", () => {
    // A valid engine B is present, so only the brpm value itself is at fault.
    expect(
      decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7&brpm=99999")
        .rpmLinked,
    ).toBeUndefined();
    expect(
      decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7&brpm=nope")
        .rpmLinked,
    ).toBeUndefined();
  });

  it("carries both crank angles when paused and unlinked", () => {
    const query = encodeShareState(
      baseState({
        config: F20C,
        comparisonConfig: LS7,
        rpmLinked: false,
        comparisonRpm: 7000,
        isPlaying: false,
        crankAngleRad: Math.PI,
        comparisonCrankAngleRad: Math.PI / 2,
      }),
    );
    expect(query).toContain("angle=180");
    expect(query).toContain("bangle=90");
  });

  it("omits engine B's angle while linked, since it equals engine A's", () => {
    const query = encodeShareState(
      baseState({
        config: F20C,
        comparisonConfig: LS7,
        rpmLinked: true,
        isPlaying: false,
        crankAngleRad: Math.PI,
      }),
    );
    expect(query).toContain("angle=180");
    expect(query).not.toContain("bangle");
  });

  it("round-trips a full unlinked redline comparison", () => {
    const original = baseState({
      config: F20C,
      comparisonConfig: LS7,
      rpm: 9000,
      comparisonRpm: 7000,
      rpmLinked: false,
      isPlaying: false,
      crankAngleRad: 1.2,
      comparisonCrankAngleRad: 4.8,
    });
    const decoded = decodeShareState(encodeShareState(original));
    expect(decoded.config).toEqual(F20C);
    expect(decoded.comparisonConfig).toEqual(LS7);
    expect(decoded.rpm).toBe(9000);
    expect(decoded.comparisonRpm).toBe(7000);
    expect(decoded.rpmLinked).toBe(false);
    expect(decoded.crankAngleRad).toBeCloseTo(1.2, 5);
    expect(decoded.comparisonCrankAngleRad).toBeCloseTo(4.8, 5);
  });
});

describe("decodeShareState", () => {
  it("reads a full link", () => {
    const state = decodeShareState(
      "?a=s2000-ap1&b=corvette-z06-c6-ls7&rpm=3000&u=in&sp=0.5&angle=90",
    );
    expect(state.config?.boreMm).toBe(87);
    expect(state.comparisonConfig?.strokeMm).toBe(101.6);
    expect(state.rpm).toBe(3000);
    expect(state.displayUnit).toBe("in");
    expect(state.playbackSpeed).toBe(0.5);
    expect(state.crankAngleRad).toBeCloseTo(Math.PI / 2, 9);
    expect(state.isPlaying).toBe(false);
  });

  it("works with or without the leading question mark", () => {
    expect(decodeShareState("a=s2000-ap1")).toEqual(
      decodeShareState("?a=s2000-ap1"),
    );
  });

  it("returns nothing for an empty query", () => {
    expect(decodeShareState("")).toEqual({});
  });

  it("ignores unknown and malformed parameters instead of failing", () => {
    const state = decodeShareState(
      "?a=s2000-ap1&b=not-a-real-engine&rpm=banana&sp=17&u=furlongs&mystery=1",
    );
    expect(state.config?.boreMm).toBe(87);
    expect(state.comparisonConfig).toBeUndefined();
    expect(state.rpm).toBeUndefined();
    expect(state.playbackSpeed).toBeUndefined();
    expect(state.displayUnit).toBeUndefined();
  });

  it("rejects an out-of-range rpm", () => {
    expect(decodeShareState("?a=s2000-ap1&rpm=99999").rpm).toBeUndefined();
    expect(decodeShareState("?a=s2000-ap1&rpm=-5").rpm).toBeUndefined();
  });

  it("normalizes angles outside one revolution", () => {
    expect(
      decodeShareState("?a=s2000-ap1&angle=450").crankAngleRad,
    ).toBeCloseTo(Math.PI / 2, 9);
    expect(
      decodeShareState("?a=s2000-ap1&angle=-90").crankAngleRad,
    ).toBeCloseTo((3 * Math.PI) / 2, 9);
  });

  it("round-trips a complete state", () => {
    const original = baseState({
      config: ENGINE_PRESETS[3]!.config,
      comparisonConfig: CUSTOM,
      rpm: 5200,
      displayUnit: "in",
      playbackSpeed: 0.25,
      isPlaying: false,
      crankAngleRad: 2.5,
    });
    const decoded = decodeShareState(encodeShareState(original));
    expect(decoded.config).toEqual(original.config);
    expect(decoded.comparisonConfig).toEqual(original.comparisonConfig);
    expect(decoded.rpm).toBe(original.rpm);
    expect(decoded.displayUnit).toBe(original.displayUnit);
    expect(decoded.playbackSpeed).toBe(original.playbackSpeed);
    expect(decoded.isPlaying).toBe(false);
    // The link carries degrees to 4 decimal places, so a radian round-trip
    // is exact to about 1e-6 rad — far finer than the 0.1 degrees the
    // interface displays.
    expect(decoded.crankAngleRad).toBeCloseTo(original.crankAngleRad, 5);
  });
});

describe("engine layouts (§24a)", () => {
  it("omits both layout params when both engines are single-cylinder", () => {
    const query = encodeShareState(baseState());
    expect(query).not.toContain("l=");
    expect(query).not.toContain("bl=");
  });

  it("includes engine A's layout whenever it isn't what `a` implies", () => {
    const query = encodeShareState(baseState({ layoutId: "v8-cross" }));
    expect(query).toContain("l=v8-cross");
  });

  it("includes engine B's layout only once engine B is present and non-default", () => {
    const noB = encodeShareState(
      baseState({ comparisonLayoutId: "inline-6" }), // no comparisonConfig
    );
    expect(noB).not.toContain("bl=");

    const withB = encodeShareState(
      baseState({ comparisonConfig: CUSTOM, comparisonLayoutId: "inline-6" }),
    );
    expect(withB).toContain("bl=inline-6");
  });

  it("omits engine B's layout when comparing but B is at its implied layout", () => {
    const query = encodeShareState(
      baseState({ comparisonConfig: LS7, comparisonLayoutId: "v8-cross" }),
    );
    expect(query).not.toContain("bl=");
  });

  it("never emits the legacy `c`/`bc` params any more", () => {
    for (const id of ENGINE_ARCHITECTURE_IDS) {
      const query = encodeShareState(
        baseState({
          config: CUSTOM,
          comparisonConfig: F20C,
          layoutId: id,
          comparisonLayoutId: id,
        }),
      );
      expect(query).not.toMatch(/(^|&)c=/);
      expect(query).not.toMatch(/(^|&)bc=/);
    }
  });

  it("decodes valid layout ids", () => {
    const state = decodeShareState(
      "?a=s2000-ap1&b=corvette-z06-c6-ls7&l=flat-4&bl=v12-60",
    );
    expect(state.layoutId).toBe("flat-4");
    expect(state.comparisonLayoutId).toBe("v12-60");
  });

  it("drops an unknown engine-A layout instead of failing the whole link", () => {
    const state = decodeShareState("?a=s2000-ap1&l=inline-8");
    expect(state.layoutId).toBeUndefined();
    expect(state.config).toBeDefined();
  });

  it("drops an unknown or malformed engine-B layout", () => {
    expect(
      decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7&bl=w16")
        .comparisonLayoutId,
    ).toBeUndefined();
    expect(
      decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7&bl=")
        .comparisonLayoutId,
    ).toBeUndefined();
  });

  it("ignores bl entirely when the link carries no usable engine B", () => {
    // No `b` at all, and a `b` that fails to decode: neither may leave
    // comparisonLayoutId set with no comparisonConfig to go with it.
    expect(
      decodeShareState("?a=s2000-ap1&bl=inline-4").comparisonLayoutId,
    ).toBeUndefined();
    expect(
      decodeShareState("?a=s2000-ap1&b=not-real&bl=inline-4")
        .comparisonLayoutId,
    ).toBeUndefined();
  });

  it("round-trips both layouts through encode/decode", () => {
    const original = baseState({
      config: F20C,
      comparisonConfig: LS7,
      layoutId: "v6-90-odd",
      comparisonLayoutId: "flat-6",
    });
    const decoded = decodeShareState(encodeShareState(original));
    expect(decoded.layoutId).toBe("v6-90-odd");
    expect(decoded.comparisonLayoutId).toBe("flat-6");
  });
});

describe("legacy `c`/`bc` cylinder counts still decode (§25a append-only)", () => {
  it("maps every multi-cylinder count onto its inline layout, whole engine shown", () => {
    const expected = {
      "3": "inline-3",
      "4": "inline-4",
      "6": "inline-6",
    } as const;

    for (const [count, layoutId] of Object.entries(expected)) {
      const a = decodeShareState(`?a=s2000-ap1&c=${count}`);
      expect(a.layoutId).toBe(layoutId);
      expect(a.singleCylinderView).toBe(false);

      const b = decodeShareState(`?a=s2000-ap1&b=s2000-ap1&bc=${count}`);
      expect(b.comparisonLayoutId).toBe(layoutId);
      expect(b.comparisonSingleCylinderView).toBe(false);
    }
  });

  it("reads the legacy `c=1` as the single-cylinder view, not an architecture", () => {
    // `c=1` predates the view/architecture split (§24a): it now means "one
    // cylinder of whatever `a` implies", so the S2000 stays an inline-4 and
    // exactly one of its cylinders is drawn — the same picture as before.
    const state = decodeShareState("?a=s2000-ap1&c=1");
    expect(state.layoutId).toBe("inline-4");
    expect(state.singleCylinderView).toBe(true);

    const b = decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7&bc=1");
    expect(b.comparisonLayoutId).toBe("v8-cross");
    expect(b.comparisonSingleCylinderView).toBe(true);
  });

  it("keeps a real old link opening exactly as it did", () => {
    // A link written by the pre-layout release: an inline-6 Supra beside a
    // single-cylinder custom engine, paused at 90 degrees. The Supra still
    // shows six cylinders; the custom engine still shows exactly one — now
    // described as one cylinder of the default architecture rather than as a
    // layout called "single".
    const state = decodeShareState(
      "?a=supra-2jzgte&b=86-86-143-10.5-7000&c=6&bc=1&rpm=4500&angle=90",
    );
    expect(state.layoutId).toBe("inline-6");
    expect(state.singleCylinderView).toBe(false);
    expect(state.comparisonLayoutId).toBe(DEFAULT_LAYOUT_ID);
    expect(state.comparisonSingleCylinderView).toBe(true);
    expect(state.rpm).toBe(4500);
    expect(state.isPlaying).toBe(false);
  });

  it("lets an explicit `l` win over a legacy `c` in the same link", () => {
    const state = decodeShareState("?a=s2000-ap1&c=6&l=v8-flat");
    expect(state.layoutId).toBe("v8-flat");

    const b = decodeShareState("?a=s2000-ap1&b=s2000-ap1&bc=6&bl=flat-4");
    expect(b.comparisonLayoutId).toBe("flat-4");
  });

  it("drops a count the old format never supported, rather than guessing", () => {
    expect(decodeShareState("?a=s2000-ap1&c=5").layoutId).toBeUndefined();
    expect(decodeShareState("?a=s2000-ap1&c=nope").layoutId).toBeUndefined();
    expect(
      decodeShareState("?a=s2000-ap1&b=s2000-ap1&bc=8").comparisonLayoutId,
    ).toBeUndefined();
  });
});

describe("preset-id share links imply the preset's real layout", () => {
  it("defaultLayoutIdFor returns the preset's own layout, or the default for a non-preset config", () => {
    expect(defaultLayoutIdFor(F20C)).toBe("inline-4");
    expect(defaultLayoutIdFor(CUSTOM)).toBe(DEFAULT_LAYOUT_ID);
    // The V engines now have real layouts of their own (§24a), so an LS7
    // link no longer falls back to a single cylinder.
    expect(defaultLayoutIdFor(LS7)).toBe("v8-cross");
  });

  it("a bare preset-id `a` with no `l` decodes to the preset's own layout, one cylinder shown", () => {
    const s2000 = decodeShareState("?a=s2000-ap1");
    expect(s2000.layoutId).toBe("inline-4");
    expect(s2000.singleCylinderView).toBe(true);

    const ferrari = decodeShareState("?a=ferrari-458-italia");
    expect(ferrari.layoutId).toBe("v8-flat");
    expect(ferrari.singleCylinderView).toBe(true);
  });

  it("an explicit `l` overrides the preset's implied layout and shows the whole engine", () => {
    const state = decodeShareState("?a=s2000-ap1&l=inline-6");
    expect(state.layoutId).toBe("inline-6");
    expect(state.singleCylinderView).toBe(false);
  });

  it("reads the legacy `l=single` as the single-cylinder view of what `a` implies", () => {
    // A deliberate "view this real engine as a single cylinder" link from
    // before the split: the architecture now comes from `a`.
    const state = decodeShareState("?a=s2000-ap1&l=single");
    expect(state.layoutId).toBe("inline-4");
    expect(state.singleCylinderView).toBe(true);
  });

  it("lets an explicit `sv` override what `l` implies, either way", () => {
    const wholeEngine = decodeShareState("?a=s2000-ap1&sv=0");
    expect(wholeEngine.layoutId).toBe("inline-4");
    expect(wholeEngine.singleCylinderView).toBe(false);

    const oneCylinder = decodeShareState("?a=s2000-ap1&l=v8-cross&sv=1");
    expect(oneCylinder.layoutId).toBe("v8-cross");
    expect(oneCylinder.singleCylinderView).toBe(true);
  });

  it("ignores a malformed `sv`, falling back to what the rest of the link implies", () => {
    expect(decodeShareState("?a=s2000-ap1&sv=maybe").singleCylinderView).toBe(
      true,
    );
    expect(
      decodeShareState("?a=s2000-ap1&l=inline-6&sv=").singleCylinderView,
    ).toBe(false);
  });

  it("says nothing about the view when the link is about something else", () => {
    // No `a`, no layout parameters: a link carrying only a speed must not
    // silently snap the current session to one cylinder.
    const state = decodeShareState("?rpm=4500");
    expect(state.layoutId).toBeUndefined();
    expect(state.singleCylinderView).toBeUndefined();
  });

  it("a numeric (non-preset) `a` with no `l` implies the default layout, one cylinder", () => {
    const state = decodeShareState(`?a=${encodeConfig(CUSTOM)}`);
    expect(state.config).toEqual(CUSTOM);
    expect(state.layoutId).toBe(DEFAULT_LAYOUT_ID);
    expect(state.singleCylinderView).toBe(true);
  });

  it("the same rules apply to engine B via `b`/`bl`/`bsv`", () => {
    const bareB = decodeShareState("?a=s2000-ap1&b=corvette-c6-ls3");
    expect(bareB.comparisonLayoutId).toBe("v8-cross");
    expect(bareB.comparisonSingleCylinderView).toBe(true);

    const legacyB = decodeShareState(
      "?a=s2000-ap1&b=corvette-c6-ls3&bl=single",
    );
    expect(legacyB.comparisonLayoutId).toBe("v8-cross");
    expect(legacyB.comparisonSingleCylinderView).toBe(true);

    const wholeB = decodeShareState("?a=s2000-ap1&b=corvette-c6-ls3&bsv=0");
    expect(wholeB.comparisonSingleCylinderView).toBe(false);

    const numericB = decodeShareState(`?a=s2000-ap1&b=${encodeConfig(CUSTOM)}`);
    expect(numericB.comparisonLayoutId).toBe(DEFAULT_LAYOUT_ID);
  });

  it("encodeShareState omits `l`/`bl` exactly when they'd round-trip to the same layout anyway", () => {
    // F20C at its own real layout: omitted, decode still infers inline-4.
    const atOwnLayout = encodeShareState(
      baseState({ config: F20C, layoutId: "inline-4" }),
    );
    expect(atOwnLayout).not.toContain("l=");
    expect(decodeShareState(atOwnLayout).layoutId).toBe("inline-4");

    // A layout the config does not imply must NOT be silently omitted, or
    // the link would corrupt back to an inline-4 on decode.
    const overridden = encodeShareState(
      baseState({ config: F20C, layoutId: "v8-cross" }),
    );
    expect(overridden).toContain("l=v8-cross");
    expect(decodeShareState(overridden).layoutId).toBe("v8-cross");

    // Same for engine B.
    const bAtOwnLayout = encodeShareState(
      baseState({
        config: DEFAULT_CONFIG,
        comparisonConfig: F20C,
        comparisonLayoutId: "inline-4",
      }),
    );
    expect(bAtOwnLayout).not.toContain("bl=");
    expect(decodeShareState(bAtOwnLayout).comparisonLayoutId).toBe("inline-4");

    const bOverridden = encodeShareState(
      baseState({
        config: DEFAULT_CONFIG,
        comparisonConfig: F20C,
        comparisonLayoutId: "flat-4",
      }),
    );
    expect(bOverridden).toContain("bl=flat-4");
    expect(decodeShareState(bOverridden).comparisonLayoutId).toBe("flat-4");
  });

  it("omits `sv` when the rest of the link already implies the view", () => {
    // Default: one cylinder of what `a` implies — nothing has to travel.
    expect(encodeShareState(baseState({ config: F20C }))).not.toMatch(
      /(^|&)sv=/,
    );
    // An explicit `l` already says "the whole of this engine".
    expect(
      encodeShareState(
        baseState({
          config: F20C,
          layoutId: "v8-cross",
          singleCylinderView: false,
        }),
      ),
    ).not.toMatch(/(^|&)sv=/);
  });

  it("carries `sv` when the view disagrees with what the link implies", () => {
    // Whole engine, but the layout is the one `a` already implies, so no `l`
    // travels and `sv=0` has to.
    const whole = encodeShareState(
      baseState({ config: F20C, singleCylinderView: false }),
    );
    expect(whole).toContain("sv=0");
    expect(decodeShareState(whole).singleCylinderView).toBe(false);

    // One cylinder, but of an architecture the config does not imply, so `l`
    // travels and `sv=1` has to travel with it.
    const one = encodeShareState(
      baseState({ config: F20C, layoutId: "v12-60" }),
    );
    expect(one).toContain("sv=1");
    const decoded = decodeShareState(one);
    expect(decoded.layoutId).toBe("v12-60");
    expect(decoded.singleCylinderView).toBe(true);
  });

  it("normalizes a legacy `single` layout on the way out rather than writing it", () => {
    // Nothing stores `"single"` any more (§24a), but an encoder handed it
    // must still produce a link that means what it always meant: one
    // cylinder of whatever `a` implies.
    const query = encodeShareState(
      baseState({ config: F20C, layoutId: "single" }),
    );
    expect(query).not.toContain("l=single");
    const decoded = decodeShareState(query);
    expect(decoded.layoutId).toBe("inline-4");
    expect(decoded.singleCylinderView).toBe(true);
  });

  it("round-trips every preset at every architecture and both views", () => {
    for (const preset of ENGINE_PRESETS) {
      for (const id of ENGINE_ARCHITECTURE_IDS) {
        for (const singleCylinderView of [true, false]) {
          const state = baseState({
            config: preset.config,
            layoutId: id,
            singleCylinderView,
          });
          const decoded = decodeShareState(encodeShareState(state));
          expect(decoded.config).toEqual(preset.config);
          expect(decoded.layoutId).toBe(id);
          expect(decoded.singleCylinderView).toBe(singleCylinderView);
        }
      }
    }
  });

  it("round-trips every preset as engine B at every architecture and both views", () => {
    for (const preset of ENGINE_PRESETS) {
      for (const id of ENGINE_ARCHITECTURE_IDS) {
        for (const comparisonSingleCylinderView of [true, false]) {
          const state = baseState({
            config: DEFAULT_CONFIG,
            comparisonConfig: preset.config,
            comparisonLayoutId: id,
            comparisonSingleCylinderView,
          });
          const decoded = decodeShareState(encodeShareState(state));
          expect(decoded.comparisonConfig).toEqual(preset.config);
          expect(decoded.comparisonLayoutId).toBe(id);
          expect(decoded.comparisonSingleCylinderView).toBe(
            comparisonSingleCylinderView,
          );
        }
      }
    }
  });
});
