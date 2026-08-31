import { describe, expect, it } from "vitest";
import {
  decodeConfig,
  decodeShareState,
  defaultCylinderCountFor,
  encodeConfig,
  encodeShareState,
} from "../engine/shareLink";
import type { ShareState } from "../engine/shareLink";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../engine/constants";
import { SUPPORTED_CYLINDER_COUNTS } from "../engine/engineLayout";
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
    cylinderCount: 1,
    comparisonCylinderCount: 1,
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
    // cylinderCount matches f20c's own real count (4, §24a) so `c` stays
    // omitted here — this test is about the `a`/`b` preset-id encoding,
    // not the `c`/`bc` cylinder-count rules covered separately below.
    const query = encodeShareState(
      baseState({
        config: f20c!.config,
        comparisonConfig: ls7!.config,
        cylinderCount: 4,
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

describe("cylinder counts (§24a)", () => {
  it("omits both counts when both engines are single-cylinder", () => {
    const query = encodeShareState(baseState());
    expect(query).not.toContain("c=");
    expect(query).not.toContain("bc=");
  });

  it("includes engine A's count whenever it isn't single-cylinder", () => {
    const query = encodeShareState(baseState({ cylinderCount: 4 }));
    expect(query).toContain("c=4");
  });

  it("includes engine B's count only once engine B is present and non-default", () => {
    const noB = encodeShareState(
      baseState({ comparisonCylinderCount: 6 }), // no comparisonConfig
    );
    expect(noB).not.toContain("bc=");

    const withB = encodeShareState(
      baseState({ comparisonConfig: LS7, comparisonCylinderCount: 6 }),
    );
    expect(withB).toContain("bc=6");
  });

  it("omits engine B's count when comparing but B is single-cylinder", () => {
    const query = encodeShareState(
      baseState({ comparisonConfig: LS7, comparisonCylinderCount: 1 }),
    );
    expect(query).not.toContain("bc=");
  });

  it("decodes valid counts", () => {
    const state = decodeShareState(
      "?a=s2000-ap1&b=corvette-z06-c6-ls7&c=4&bc=6",
    );
    expect(state.cylinderCount).toBe(4);
    expect(state.comparisonCylinderCount).toBe(6);
  });

  it("drops an unsupported engine-A count instead of failing the whole link", () => {
    const state = decodeShareState("?a=s2000-ap1&c=5");
    expect(state.cylinderCount).toBeUndefined();
    expect(state.config).toBeDefined();
  });

  it("drops an unsupported, non-finite, or malformed engine-B count", () => {
    expect(
      decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7&bc=8")
        .comparisonCylinderCount,
    ).toBeUndefined();
    expect(
      decodeShareState("?a=s2000-ap1&b=corvette-z06-c6-ls7&bc=nope")
        .comparisonCylinderCount,
    ).toBeUndefined();
  });

  it("ignores bc entirely when the link carries no usable engine B", () => {
    // No `b` at all, and a `b` that fails to decode: neither may leave
    // comparisonCylinderCount set with no comparisonConfig to go with it.
    expect(decodeShareState("?a=s2000-ap1&bc=4").comparisonCylinderCount).toBe(
      undefined,
    );
    expect(
      decodeShareState("?a=s2000-ap1&b=not-real&bc=4").comparisonCylinderCount,
    ).toBeUndefined();
  });

  it("round-trips both counts through encode/decode", () => {
    const original = baseState({
      config: F20C,
      comparisonConfig: LS7,
      cylinderCount: 4,
      comparisonCylinderCount: 6,
    });
    const decoded = decodeShareState(encodeShareState(original));
    expect(decoded.cylinderCount).toBe(4);
    expect(decoded.comparisonCylinderCount).toBe(6);
  });
});

describe("preset-id share links imply the preset's real cylinder count", () => {
  it("defaultCylinderCountFor returns the preset's own count, or 1 for a non-preset config", () => {
    expect(defaultCylinderCountFor(F20C)).toBe(4);
    expect(defaultCylinderCountFor(CUSTOM)).toBe(1);
    // LS7 (a V8) isn't a currently-renderable layout, so its preset omits
    // `cylinderCount` — falls back to 1, same as any non-preset config.
    expect(defaultCylinderCountFor(LS7)).toBe(1);
  });

  it("a bare preset-id `a` with no `c` decodes to the preset's own cylinder count", () => {
    // s2000-ap1 (F20C) is a real inline-4 (§24a); with no `c` at all, the
    // link must not silently render as a single cylinder.
    const state = decodeShareState("?a=s2000-ap1");
    expect(state.cylinderCount).toBe(4);
  });

  it("an explicit `c` still overrides the preset's implied count", () => {
    // A deliberate "view this real engine as a single cylinder" link.
    const state = decodeShareState("?a=s2000-ap1&c=1");
    expect(state.cylinderCount).toBe(1);

    const state6 = decodeShareState("?a=s2000-ap1&c=6");
    expect(state6.cylinderCount).toBe(6);
  });

  it("a numeric (non-preset) `a` with no `c` implies 1, not the current session's count", () => {
    const state = decodeShareState(`?a=${encodeConfig(CUSTOM)}`);
    expect(state.config).toEqual(CUSTOM);
    expect(state.cylinderCount).toBe(1);
  });

  it("the same rules apply to engine B via `b`/`bc`", () => {
    const bareB = decodeShareState("?a=s2000-ap1&b=s2000-ap1");
    expect(bareB.comparisonCylinderCount).toBe(4);

    const overriddenB = decodeShareState("?a=s2000-ap1&b=s2000-ap1&bc=1");
    expect(overriddenB.comparisonCylinderCount).toBe(1);

    const numericB = decodeShareState(`?a=s2000-ap1&b=${encodeConfig(CUSTOM)}`);
    expect(numericB.comparisonCylinderCount).toBe(1);
  });

  it("encodeShareState omits `c`/`bc` exactly when they'd round-trip to the same count anyway", () => {
    // F20C at its own real count (4): omitted, decode still infers 4.
    const atOwnCount = encodeShareState(
      baseState({ config: F20C, cylinderCount: 4 }),
    );
    expect(atOwnCount).not.toContain("c=");
    expect(decodeShareState(atOwnCount).cylinderCount).toBe(4);

    // F20C deliberately viewed at count 1: must NOT be silently omitted,
    // or the link would corrupt back to an inline-4 on decode (the bug
    // this fix addresses).
    const overridden = encodeShareState(
      baseState({ config: F20C, cylinderCount: 1 }),
    );
    expect(overridden).toContain("c=1");
    expect(decodeShareState(overridden).cylinderCount).toBe(1);

    // Same for engine B.
    const bAtOwnCount = encodeShareState(
      baseState({
        config: DEFAULT_CONFIG,
        comparisonConfig: F20C,
        comparisonCylinderCount: 4,
      }),
    );
    expect(bAtOwnCount).not.toContain("bc=");
    expect(decodeShareState(bAtOwnCount).comparisonCylinderCount).toBe(4);

    const bOverridden = encodeShareState(
      baseState({
        config: DEFAULT_CONFIG,
        comparisonConfig: F20C,
        comparisonCylinderCount: 1,
      }),
    );
    expect(bOverridden).toContain("bc=1");
    expect(decodeShareState(bOverridden).comparisonCylinderCount).toBe(1);
  });

  it("round-trips every preset at every supported cylinder count", () => {
    for (const preset of ENGINE_PRESETS) {
      for (const count of SUPPORTED_CYLINDER_COUNTS) {
        const state = baseState({
          config: preset.config,
          cylinderCount: count,
        });
        const decoded = decodeShareState(encodeShareState(state));
        expect(decoded.config).toEqual(preset.config);
        expect(decoded.cylinderCount).toBe(count);
      }
    }
  });

  it("round-trips every preset as engine B at every supported cylinder count", () => {
    for (const preset of ENGINE_PRESETS) {
      for (const count of SUPPORTED_CYLINDER_COUNTS) {
        const state = baseState({
          config: DEFAULT_CONFIG,
          comparisonConfig: preset.config,
          comparisonCylinderCount: count,
        });
        const decoded = decodeShareState(encodeShareState(state));
        expect(decoded.comparisonConfig).toEqual(preset.config);
        expect(decoded.comparisonCylinderCount).toBe(count);
      }
    }
  });
});
