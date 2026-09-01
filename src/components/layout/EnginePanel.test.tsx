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
    engineFamily: "piston",
    comparisonEngineFamily: "piston",
    preferences: {
      displayUnit: "mm",
      showLabels: true,
      showCycle: false,
      uprightFlatEngines: false,
    },
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

  describe("engine family (§27)", () => {
    it("shows rotary controls instead of piston controls once the slot's family is rotary", () => {
      useEngineStore.setState({ engineFamily: "rotary" });
      render(<EnginePanel slot="primary" />);

      // The rotary geometry fields are present...
      expect(
        screen.getByLabelText(/generating radius \(r\)/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: /rotary presets/i }),
      ).toBeInTheDocument();
      // ...and the piston-only ones are gone.
      expect(screen.queryByLabelText(/bore \(mm\)/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: /^presets$/i }),
      ).not.toBeInTheDocument();
    });

    it("always shows the family switch itself, in either family", () => {
      // The panel also renders `CylinderViewToggle` (piston-only), a
      // second `role="switch"` control, so this query is scoped by
      // accessible name rather than role alone.
      const familySwitch = () =>
        screen.getByRole("switch", { name: "Rotary engine family" });

      const piston = render(<EnginePanel slot="primary" />);
      expect(familySwitch()).toBeInTheDocument();
      piston.unmount();

      useEngineStore.setState({ engineFamily: "rotary" });
      render(<EnginePanel slot="primary" />);
      expect(familySwitch()).toBeInTheDocument();
    });

    it("scopes a rotary comparison slot's family switch to its own slot", async () => {
      act(() => {
        useEngineStore.getState().enableComparison();
      });
      useEngineStore.setState({
        engineFamily: "piston",
        comparisonEngineFamily: "rotary",
      });
      render(<EnginePanel slot="comparison" heading="Engine B" />);

      expect(
        screen.getByLabelText(/generating radius \(r\)/i),
      ).toBeInTheDocument();
      expect(useEngineStore.getState().engineFamily).toBe("piston");
    });
  });
});
