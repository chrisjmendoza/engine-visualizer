import { beforeEach, describe, expect, it } from "vitest";
import { useEngineStore } from "./engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../engine/constants";
import { DEFAULT_LAYOUT_ID } from "../engine/engineLayout";

/** Resets the store to its module-level initial state before each test. */
function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    layoutId: DEFAULT_LAYOUT_ID,
    comparisonLayoutId: DEFAULT_LAYOUT_ID,
    singleCylinderView: true,
    comparisonSingleCylinderView: true,
    preferences: { displayUnit: "mm", showLabels: true, showCycle: false },
    rpm: DEFAULT_ANIMATION.rpm,
    comparisonRpm: DEFAULT_ANIMATION.rpm,
    rpmLinked: true,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
    comparisonCrankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

beforeEach(() => {
  resetStore();
});

describe("enableComparison — comparisonRpm seeding", () => {
  it("copies the current rpm into comparisonRpm", () => {
    useEngineStore.setState({ rpm: 9000 });

    useEngineStore.getState().enableComparison();

    expect(useEngineStore.getState().comparisonRpm).toBe(9000);
  });

  it("a later re-enable re-seeds comparisonRpm from the then-current rpm", () => {
    useEngineStore.setState({ rpm: 4000 });
    useEngineStore.getState().enableComparison();
    expect(useEngineStore.getState().comparisonRpm).toBe(4000);

    // Disable, change speed, and re-enable: the fresh seed must reflect
    // whatever engine A is running at *now*, not the first seed.
    useEngineStore.getState().disableComparison();
    useEngineStore.setState({ rpm: 6500 });
    useEngineStore.getState().enableComparison();

    expect(useEngineStore.getState().comparisonRpm).toBe(6500);
  });

  it("the first-ever unlink starts engine B at the shared speed rather than the pristine default", () => {
    useEngineStore.setState({ rpm: 9000 });
    useEngineStore.getState().enableComparison();

    useEngineStore.getState().setRpmLinked(false);

    expect(useEngineStore.getState().comparisonRpm).toBe(9000);
    expect(useEngineStore.getState().comparisonRpm).not.toBe(
      DEFAULT_ANIMATION.rpm,
    );
  });
});

describe("layoutId / comparisonLayoutId — setters", () => {
  it("setLayoutId updates layoutId without touching crank angle or playback", () => {
    useEngineStore.setState({ crankAngleRad: 1.23, isPlaying: false });

    useEngineStore.getState().setLayoutId("v8-cross");

    expect(useEngineStore.getState().layoutId).toBe("v8-cross");
    expect(useEngineStore.getState().crankAngleRad).toBe(1.23);
    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("setComparisonLayoutId updates comparisonLayoutId without touching crank angle or playback", () => {
    useEngineStore.setState({ comparisonCrankAngleRad: 2.5, isPlaying: true });

    useEngineStore.getState().setComparisonLayoutId("flat-6");

    expect(useEngineStore.getState().comparisonLayoutId).toBe("flat-6");
    expect(useEngineStore.getState().comparisonCrankAngleRad).toBe(2.5);
    expect(useEngineStore.getState().isPlaying).toBe(true);
  });

  it("changing engine A's layout leaves engine B's alone, and vice versa", () => {
    useEngineStore.getState().enableComparison();

    useEngineStore.getState().setLayoutId("inline-5");
    expect(useEngineStore.getState().comparisonLayoutId).toBe(
      DEFAULT_LAYOUT_ID,
    );

    useEngineStore.getState().setComparisonLayoutId("v12-60");
    expect(useEngineStore.getState().layoutId).toBe("inline-5");
  });
});

describe("enableComparison — comparisonLayoutId seeding", () => {
  it("copies the current layoutId into comparisonLayoutId", () => {
    useEngineStore.setState({ layoutId: "inline-6" });

    useEngineStore.getState().enableComparison();

    expect(useEngineStore.getState().comparisonLayoutId).toBe("inline-6");
  });

  it("a later re-enable re-seeds comparisonLayoutId from the then-current layoutId", () => {
    useEngineStore.setState({ layoutId: "inline-3" });
    useEngineStore.getState().enableComparison();
    expect(useEngineStore.getState().comparisonLayoutId).toBe("inline-3");

    useEngineStore.getState().disableComparison();
    useEngineStore.setState({ layoutId: "v8-flat" });
    useEngineStore.getState().enableComparison();

    expect(useEngineStore.getState().comparisonLayoutId).toBe("v8-flat");
  });

  it("disableComparison leaves comparisonLayoutId alone", () => {
    useEngineStore.setState({ layoutId: "inline-4" });
    useEngineStore.getState().enableComparison();
    useEngineStore.getState().setComparisonLayoutId("flat-4");

    useEngineStore.getState().disableComparison();

    expect(useEngineStore.getState().comparisonLayoutId).toBe("flat-4");
  });
});

describe("setRpmLinked — comparisonRpm retention", () => {
  it("does not overwrite comparisonRpm when linking or unlinking", () => {
    useEngineStore.setState({ rpm: 9000 });
    useEngineStore.getState().enableComparison();
    useEngineStore.getState().setComparisonRpm(5500);

    useEngineStore.getState().setRpmLinked(true);
    expect(useEngineStore.getState().comparisonRpm).toBe(5500);

    useEngineStore.getState().setRpmLinked(false);
    expect(useEngineStore.getState().comparisonRpm).toBe(5500);
  });

  it("a link/unlink cycle preserves a user-set comparisonRpm even as engine A's rpm changes", () => {
    useEngineStore.getState().enableComparison();
    useEngineStore.getState().setRpmLinked(false);
    useEngineStore.getState().setComparisonRpm(7200);
    useEngineStore.getState().setRpmLinked(true);

    // While linked, engine A's speed can move freely without touching B's
    // retained choice.
    useEngineStore.getState().setRpm(3300);
    expect(useEngineStore.getState().comparisonRpm).toBe(7200);

    useEngineStore.getState().setRpmLinked(false);
    expect(useEngineStore.getState().comparisonRpm).toBe(7200);
  });
});

describe("singleCylinderView — the view/architecture split (§24a)", () => {
  it("opens on one cylinder of the default architecture", () => {
    // The pristine module-level state, not the test reset: this is what a
    // first-time visitor sees.
    const fresh = useEngineStore.getInitialState();
    expect(fresh.singleCylinderView).toBe(true);
    expect(fresh.comparisonSingleCylinderView).toBe(true);
    expect(fresh.layoutId).toBe(DEFAULT_LAYOUT_ID);
    expect(fresh.comparisonLayoutId).toBe(DEFAULT_LAYOUT_ID);
    expect(fresh.layoutId).not.toBe("single");
  });

  it("setSingleCylinderView never touches the layout, crank angle, or playback", () => {
    useEngineStore.setState({
      layoutId: "v8-cross",
      crankAngleRad: 1.23,
      isPlaying: true,
    });

    useEngineStore.getState().setSingleCylinderView(false);

    expect(useEngineStore.getState().singleCylinderView).toBe(false);
    expect(useEngineStore.getState().layoutId).toBe("v8-cross");
    expect(useEngineStore.getState().crankAngleRad).toBe(1.23);
    expect(useEngineStore.getState().isPlaying).toBe(true);
  });

  it("setLayoutId never touches the view — picking an engine keeps the cylinder you were studying", () => {
    useEngineStore.setState({ singleCylinderView: true });

    useEngineStore.getState().setLayoutId("v8-cross");

    expect(useEngineStore.getState().layoutId).toBe("v8-cross");
    expect(useEngineStore.getState().singleCylinderView).toBe(true);
  });

  it("each engine's view is independent", () => {
    useEngineStore.getState().enableComparison();

    useEngineStore.getState().setSingleCylinderView(false);
    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(true);

    useEngineStore.getState().setComparisonSingleCylinderView(false);
    useEngineStore.getState().setSingleCylinderView(true);
    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(false);
  });

  it("enableComparison seeds engine B's view from engine A's", () => {
    useEngineStore.setState({ singleCylinderView: false });

    useEngineStore.getState().enableComparison();

    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(false);
  });

  it("a later re-enable re-seeds the view from the then-current one", () => {
    useEngineStore.setState({ singleCylinderView: false });
    useEngineStore.getState().enableComparison();
    useEngineStore.getState().setComparisonSingleCylinderView(true);

    useEngineStore.getState().disableComparison();
    // disableComparison leaves engine B's view alone, like every other
    // comparison field...
    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(true);

    useEngineStore.setState({ singleCylinderView: true });
    useEngineStore.getState().enableComparison();
    // ...and re-enabling re-seeds it from engine A rather than restoring the
    // stale value.
    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(true);
  });
});

describe("hydrateFromShareState — cylinder views", () => {
  it("applies both views when the link carried them", () => {
    useEngineStore.getState().hydrateFromShareState({
      singleCylinderView: false,
      comparisonSingleCylinderView: false,
    });

    expect(useEngineStore.getState().singleCylinderView).toBe(false);
    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(false);
  });

  it("leaves the current views alone when the link said nothing about them", () => {
    useEngineStore.setState({
      singleCylinderView: false,
      comparisonSingleCylinderView: true,
    });

    useEngineStore.getState().hydrateFromShareState({ rpm: 4500 });

    expect(useEngineStore.getState().singleCylinderView).toBe(false);
    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(true);
    expect(useEngineStore.getState().rpm).toBe(4500);
  });
});
