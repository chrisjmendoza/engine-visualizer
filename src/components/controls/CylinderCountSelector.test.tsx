import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CylinderCountSelector } from "./CylinderCountSelector";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    cylinderCount: 1,
    comparisonCylinderCount: 1,
    preferences: { displayUnit: "mm", showLabels: true, showCycle: false },
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

describe("CylinderCountSelector", () => {
  it("defaults to Single and lists every supported layout", () => {
    render(<CylinderCountSelector />);

    const select = screen.getByLabelText(/cylinders/i) as HTMLSelectElement;
    expect(select.value).toBe("1");
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toEqual([
      "Single",
      "Inline-3",
      "Inline-4",
      "Inline-6",
    ]);
  });

  it("updates cylinderCount (engine A) on selection, without touching crank angle or playback", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({ crankAngleRad: 1.23, isPlaying: true });
    render(<CylinderCountSelector />);

    await user.selectOptions(screen.getByLabelText(/cylinders/i), "4");

    expect(useEngineStore.getState().cylinderCount).toBe(4);
    expect(useEngineStore.getState().crankAngleRad).toBe(1.23);
    expect(useEngineStore.getState().isPlaying).toBe(true);
  });

  it("reflects and updates comparisonCylinderCount for the comparison slot, independent of engine A", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    const user = userEvent.setup();
    render(<CylinderCountSelector slot="comparison" />);

    await user.selectOptions(screen.getByLabelText(/cylinders/i), "6");

    expect(useEngineStore.getState().comparisonCylinderCount).toBe(6);
    expect(useEngineStore.getState().cylinderCount).toBe(1);
  });

  it("reads the comparison slot's own current value, not engine A's", () => {
    useEngineStore.setState({ cylinderCount: 4, comparisonCylinderCount: 6 });
    render(<CylinderCountSelector slot="comparison" />);

    const select = screen.getByLabelText(/cylinders/i) as HTMLSelectElement;
    expect(select.value).toBe("6");
  });
});
