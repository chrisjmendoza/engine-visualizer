import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useShareLinkSync } from "./useShareLinkSync";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../../engine/constants";
import { ENGINE_PRESETS } from "../../engine/presets";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    preferences: { displayUnit: "mm", showLabels: true },
    rpm: DEFAULT_ANIMATION.rpm,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    isPlaying: true,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

/** Sets the address bar without a page navigation, as a shared link would arrive. */
function setLocation(search: string) {
  window.history.pushState({}, "", search ? `/?${search}` : "/");
}

// `cleanup()` alone was observed to leave a previous test's store
// subscription active into the next test in this file (each `renderHook`
// call below owns a real `useEngineStore.subscribe`, which then double-
// fires `history.replaceState` once a second test's changes land) —
// explicitly unmounting every hook this file renders, before `cleanup()`,
// closes that gap regardless of the underlying scheduler/timer timing.
let activeUnmounts: (() => void)[] = [];

function renderShareLinkSync() {
  const result = renderHook(() => useShareLinkSync());
  activeUnmounts.push(result.unmount);
  return result;
}

beforeEach(() => {
  resetStore();
  setLocation("");
});

afterEach(() => {
  for (const unmount of activeUnmounts.splice(0)) {
    unmount();
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
  cleanup();
});

describe("useShareLinkSync — hydration", () => {
  it("hydrates config, comparison, units, rpm, and angle (paused) from a full link", () => {
    const engineA = ENGINE_PRESETS.find((p) => p.id === "s2000-ap1");
    const engineB = ENGINE_PRESETS.find((p) => p.id === "corvette-z06-c6-ls7");
    if (!engineA || !engineB) {
      throw new Error("expected fixture presets to exist");
    }
    setLocation(
      "a=s2000-ap1&b=corvette-z06-c6-ls7&rpm=3000&u=in&sp=0.25&angle=90",
    );

    renderShareLinkSync();

    const state = useEngineStore.getState();
    expect(state.config).toEqual(engineA.config);
    expect(state.comparisonConfig).toEqual(engineB.config);
    expect(state.rpm).toBe(3000);
    expect(state.preferences.displayUnit).toBe("in");
    expect(state.playbackSpeed).toBe(0.25);
    expect(state.crankAngleRad).toBeCloseTo(Math.PI / 2, 5);
    // A link that carries an angle implies a paused, exact position.
    expect(state.isPlaying).toBe(false);
  });

  it("leaves comparison off when the link has no engine B", () => {
    setLocation("a=s2000-ap1");

    renderShareLinkSync();

    expect(useEngineStore.getState().comparisonConfig).toBeNull();
  });

  it("does not touch isPlaying when the link carries no angle, preserving the reduced-motion-aware default", () => {
    // Simulates the store's already-paused reduced-motion initial state.
    useEngineStore.setState({ isPlaying: false });
    setLocation("a=s2000-ap1&rpm=4000");

    renderShareLinkSync();

    // rpm still applies...
    expect(useEngineStore.getState().rpm).toBe(4000);
    // ...but isPlaying is untouched, not forced to true.
    expect(useEngineStore.getState().isPlaying).toBe(false);
  });

  it("leaves every default intact for a malformed link, without throwing", () => {
    setLocation(
      "a=not-a-real-preset&b=also-fake&rpm=banana&u=furlongs&sp=17&angle=notanumber&mystery=1",
    );

    expect(() => renderShareLinkSync()).not.toThrow();

    const state = useEngineStore.getState();
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(state.comparisonConfig).toBeNull();
    expect(state.rpm).toBe(DEFAULT_ANIMATION.rpm);
    expect(state.preferences.displayUnit).toBe("mm");
    expect(state.playbackSpeed).toBe(DEFAULT_PLAYBACK_SPEED);
    expect(state.isPlaying).toBe(true);
  });

  it("does nothing for an empty query", () => {
    setLocation("");

    renderShareLinkSync();

    const state = useEngineStore.getState();
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(state.rpm).toBe(DEFAULT_ANIMATION.rpm);
    expect(state.isPlaying).toBe(true);
  });
});

describe("useShareLinkSync — address-bar sync", () => {
  it("writes the address bar's query string after the debounce, via replaceState (not pushState)", () => {
    vi.useFakeTimers();
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    renderShareLinkSync();

    expect(window.location.search).toBe("");

    act(() => {
      useEngineStore.getState().setRpm(3000);
    });

    // Still inside the debounce window.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(window.location.search).toBe("");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(window.location.search).toBe("?a=86-86-143-10.5-7000&rpm=3000");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid successive changes into a single write", () => {
    vi.useFakeTimers();
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    renderShareLinkSync();

    act(() => {
      useEngineStore.getState().setRpm(1000);
    });
    act(() => {
      vi.advanceTimersByTime(100);
      useEngineStore.getState().setRpm(2000);
    });
    act(() => {
      vi.advanceTimersByTime(100);
      useEngineStore.getState().setRpm(3000);
    });
    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(window.location.search).toBe("?a=86-86-143-10.5-7000&rpm=3000");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });

  it("turns comparison on/off and reflects it in the query", () => {
    vi.useFakeTimers();
    renderShareLinkSync();

    act(() => {
      useEngineStore.getState().enableComparison(DEFAULT_CONFIG);
      vi.advanceTimersByTime(260);
    });

    expect(window.location.search).toContain("b=86-86-143-10.5-7000");
  });

  it("does not let the crank angle ticking while playing (10 Hz) block or delay a real pending change", () => {
    vi.useFakeTimers();
    useEngineStore.setState({ isPlaying: true });
    renderShareLinkSync();

    act(() => {
      useEngineStore.getState().setRpm(3000);
    });
    act(() => {
      vi.advanceTimersByTime(100);
      // The animation loop's throttled mirror — encodeShareState omits the
      // angle entirely while playing, so this must not reset the debounce.
      useEngineStore.getState().syncCrankAngle(0.5);
    });
    act(() => {
      vi.advanceTimersByTime(100);
      useEngineStore.getState().syncCrankAngle(1.0);
    });
    // 260ms after the *original* rpm change, not after the last angle tick.
    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(window.location.search).toContain("rpm=3000");
    expect(window.location.search).not.toContain("angle");
  });

  it("keeps the path intact and only changes the query string", () => {
    window.history.pushState({}, "", "/engine-visualizer/?a=s2000-ap1");
    vi.useFakeTimers();
    renderShareLinkSync();

    act(() => {
      useEngineStore.getState().setRpm(5000);
      vi.advanceTimersByTime(260);
    });

    expect(window.location.pathname).toBe("/engine-visualizer/");
    expect(window.location.search).toContain("rpm=5000");
  });
});
