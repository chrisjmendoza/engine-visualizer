import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnitSelector } from "./UnitSelector";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    preferences: {
      displayUnit: "mm",
      showLabels: true,
      showCycle: false,
      uprightFlatEngines: false,
    },
    rpm: DEFAULT_ANIMATION.rpm,
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

describe("UnitSelector", () => {
  it("switches the display unit without changing stored geometry", async () => {
    const user = userEvent.setup();
    render(<UnitSelector />);

    const boreMmBefore = useEngineStore.getState().config.boreMm;
    await user.click(screen.getByLabelText(/inches/i));

    expect(useEngineStore.getState().preferences.displayUnit).toBe("in");
    expect(useEngineStore.getState().config.boreMm).toBe(boreMmBefore);

    await user.click(screen.getByLabelText(/millimeters/i));
    expect(useEngineStore.getState().preferences.displayUnit).toBe("mm");
  });

  it("toggles the show-labels preference", async () => {
    const user = userEvent.setup();
    render(<UnitSelector />);

    const checkbox = screen.getByLabelText(/show component labels/i);
    expect(useEngineStore.getState().preferences.showLabels).toBe(true);

    await user.click(checkbox);
    expect(useEngineStore.getState().preferences.showLabels).toBe(false);
  });

  it("toggles the four-stroke cycle preference, off by default", async () => {
    const user = userEvent.setup();
    render(<UnitSelector />);

    const checkbox = screen.getByLabelText(/four-stroke cycle/i);
    expect(useEngineStore.getState().preferences.showCycle).toBe(false);

    await user.click(checkbox);
    expect(useEngineStore.getState().preferences.showCycle).toBe(true);

    await user.click(checkbox);
    expect(useEngineStore.getState().preferences.showCycle).toBe(false);
  });

  it("toggles the stand-flat-engines-upright preference, off by default", async () => {
    const user = userEvent.setup();
    render(<UnitSelector />);

    // Labelled for what it affects: it concerns flat/boxer layouts only.
    const checkbox = screen.getByLabelText(/stand flat engines upright/i);
    expect(useEngineStore.getState().preferences.uprightFlatEngines).toBe(
      false,
    );

    await user.click(checkbox);
    expect(useEngineStore.getState().preferences.uprightFlatEngines).toBe(true);

    await user.click(checkbox);
    expect(useEngineStore.getState().preferences.uprightFlatEngines).toBe(
      false,
    );
  });
});
