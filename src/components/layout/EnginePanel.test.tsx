import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnginePanel } from "./EnginePanel";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    preferences: { displayUnit: "mm", showLabels: true },
    rpm: DEFAULT_ANIMATION.rpm,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    isPlaying: false,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

beforeEach(() => {
  resetStore();
});

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

describe("EnginePanel", () => {
  it("renders without an engine-disambiguating heading when none is given (single-engine mode)", () => {
    render(<EnginePanel slot="primary" />);
    // No "Engine A"/"Engine B" heading — only CalculationPanel's own
    // "Calculated results" heading, unchanged from non-comparison mode.
    expect(
      screen.queryByRole("heading", { name: /engine [ab]/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /calculated results/i }),
    ).toBeInTheDocument();
    // The primary engine's geometry controls are still present.
    expect(screen.getByLabelText(/bore \(mm\)/i)).toBeInTheDocument();
  });

  it("labels the group with the given heading and scopes edits to its slot", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    const user = userEvent.setup();
    render(<EnginePanel slot="comparison" heading="Engine B" />);

    expect(
      screen.getByRole("heading", { name: "Engine B", level: 2 }),
    ).toBeInTheDocument();

    const boreInput = screen.getByLabelText(/bore \(mm\)/i);
    await user.clear(boreInput);
    await user.type(boreInput, "77");

    expect(useEngineStore.getState().comparisonConfig?.boreMm).toBe(77);
    expect(useEngineStore.getState().config.boreMm).toBe(DEFAULT_CONFIG.boreMm);
  });

  it("omits its CalculationPanel when showResults is false, keeping presets and geometry", () => {
    render(<EnginePanel slot="primary" showResults={false} />);

    expect(
      screen.queryByRole("heading", { name: /calculated results/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/bore \(mm\)/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /presets/i })).toBeInTheDocument();
  });
});
