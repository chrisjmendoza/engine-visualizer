import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CylinderViewToggle } from "./CylinderViewToggle";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";
import { DEFAULT_LAYOUT_ID } from "../../engine/engineLayout";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    layoutId: DEFAULT_LAYOUT_ID,
    comparisonLayoutId: DEFAULT_LAYOUT_ID,
    singleCylinderView: true,
    comparisonSingleCylinderView: true,
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

/** The one switch this component renders. */
function getSwitch(): HTMLElement {
  return screen.getByRole("switch");
}

describe("CylinderViewToggle", () => {
  it("is a real switch, unchecked while only one cylinder is shown", () => {
    render(<CylinderViewToggle />);

    const control = getSwitch();
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(control).toHaveAccessibleName("Show all cylinders");
  });

  it("reads as checked once the whole engine is shown", () => {
    useEngineStore.setState({ singleCylinderView: false });
    render(<CylinderViewToggle />);

    const control = getSwitch();
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(control).toHaveAccessibleName("Show all cylinders");
  });

  it("keeps the same accessible name in both states, so it never announces as a different control", () => {
    const { rerender } = render(<CylinderViewToggle />);
    expect(getSwitch()).toHaveAccessibleName("Show all cylinders");

    useEngineStore.setState({ singleCylinderView: false });
    rerender(<CylinderViewToggle />);
    expect(getSwitch()).toHaveAccessibleName("Show all cylinders");
  });

  it("shows both option labels regardless of state, for sighted users who never toggle it", () => {
    render(<CylinderViewToggle />);

    expect(screen.getByText("Single cylinder")).toBeInTheDocument();
    expect(screen.getByText("Full engine")).toBeInTheDocument();
  });

  it("toggles the view on click, without touching the layout, crank angle, or playback", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({
      layoutId: "v8-cross",
      crankAngleRad: 1.23,
      isPlaying: true,
    });
    render(<CylinderViewToggle />);

    await user.click(getSwitch());

    const state = useEngineStore.getState();
    expect(state.singleCylinderView).toBe(false);
    expect(state.layoutId).toBe("v8-cross");
    expect(state.crankAngleRad).toBe(1.23);
    expect(state.isPlaying).toBe(true);
  });

  it("toggles back again", async () => {
    const user = userEvent.setup();
    render(<CylinderViewToggle />);

    await user.click(getSwitch());
    expect(useEngineStore.getState().singleCylinderView).toBe(false);

    await user.click(getSwitch());
    expect(useEngineStore.getState().singleCylinderView).toBe(true);
  });

  it("is reachable and operable from the keyboard, with Space and Enter", async () => {
    const user = userEvent.setup();
    render(<CylinderViewToggle />);

    await user.tab();
    expect(getSwitch()).toHaveFocus();

    await user.keyboard(" ");
    expect(useEngineStore.getState().singleCylinderView).toBe(false);

    await user.keyboard("{Enter}");
    expect(useEngineStore.getState().singleCylinderView).toBe(true);
  });

  it("reads and writes the comparison slot's own view, independent of engine A", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    useEngineStore.setState({
      singleCylinderView: true,
      comparisonSingleCylinderView: false,
    });
    const user = userEvent.setup();
    render(<CylinderViewToggle slot="comparison" />);

    expect(getSwitch()).toHaveAttribute("aria-checked", "true");

    await user.click(getSwitch());

    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(true);
    expect(useEngineStore.getState().singleCylinderView).toBe(true);
  });

  it("leaves engine B's view alone when engine A's is switched", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    const user = userEvent.setup();
    render(<CylinderViewToggle />);

    await user.click(getSwitch());

    expect(useEngineStore.getState().singleCylinderView).toBe(false);
    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(true);
  });
});
