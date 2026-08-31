import { beforeEach, describe, expect, it } from "vitest";
import { useEngineStore } from "./engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../engine/constants";

/** Resets the store to its module-level initial state before each test. */
function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    preferences: { displayUnit: "mm", showLabels: true },
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
