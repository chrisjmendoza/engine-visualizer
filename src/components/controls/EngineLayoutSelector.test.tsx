import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EngineLayoutSelector } from "./EngineLayoutSelector";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";
import {
  DEFAULT_LAYOUT_ID,
  ENGINE_ARCHITECTURE_IDS,
  createEngineLayout,
} from "../../engine/engineLayout";

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

describe("EngineLayoutSelector", () => {
  it("defaults to the default layout and offers every architecture in the roster", () => {
    render(<EngineLayoutSelector />);

    const select = screen.getByLabelText(/layout/i) as HTMLSelectElement;
    expect(select.value).toBe(DEFAULT_LAYOUT_ID);

    const values = Array.from(select.options).map((option) => option.value);
    expect(new Set(values)).toEqual(new Set(ENGINE_ARCHITECTURE_IDS));
    // Each option is named by its layout's own label, not by a duplicate
    // table in the component.
    for (const option of Array.from(select.options)) {
      const layout = ENGINE_ARCHITECTURE_IDS.find((id) => id === option.value);
      expect(layout).toBeDefined();
      expect(option.textContent).toBe(createEngineLayout(layout!).label);
    }
  });

  it("does not offer the legacy single-cylinder layout — that is now a view", () => {
    render(<EngineLayoutSelector />);

    const select = screen.getByLabelText(/layout/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).not.toContain("single");
  });

  it("groups the roster by kind", () => {
    render(<EngineLayoutSelector />);

    const select = screen.getByLabelText(/layout/i) as HTMLSelectElement;
    const groups = Array.from(
      select.querySelectorAll("optgroup"),
    ) as HTMLOptGroupElement[];
    expect(groups.map((group) => group.label)).toEqual(["Inline", "V", "Flat"]);
  });

  it("updates layoutId (engine A) on selection, without touching crank angle or playback", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({ crankAngleRad: 1.23, isPlaying: true });
    render(<EngineLayoutSelector />);

    await user.selectOptions(screen.getByLabelText(/layout/i), "v8-cross");

    expect(useEngineStore.getState().layoutId).toBe("v8-cross");
    expect(useEngineStore.getState().crankAngleRad).toBe(1.23);
    expect(useEngineStore.getState().isPlaying).toBe(true);
  });

  it("reflects and updates comparisonLayoutId for the comparison slot, independent of engine A", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    const user = userEvent.setup();
    render(<EngineLayoutSelector slot="comparison" />);

    await user.selectOptions(screen.getByLabelText(/layout/i), "flat-6");

    expect(useEngineStore.getState().comparisonLayoutId).toBe("flat-6");
    expect(useEngineStore.getState().layoutId).toBe(DEFAULT_LAYOUT_ID);
  });

  it("shows the whole engine when a layout is picked, so the viewport matches the label", async () => {
    useEngineStore.setState({ singleCylinderView: true });
    const user = userEvent.setup();
    render(<EngineLayoutSelector />);

    await user.selectOptions(screen.getByLabelText(/layout/i), "v8-cross");

    expect(useEngineStore.getState().layoutId).toBe("v8-cross");
    expect(useEngineStore.getState().singleCylinderView).toBe(false);
  });

  it("switches only its own slot's view to the whole engine", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    useEngineStore.setState({
      singleCylinderView: true,
      comparisonSingleCylinderView: true,
    });
    const user = userEvent.setup();
    render(<EngineLayoutSelector slot="comparison" />);

    await user.selectOptions(screen.getByLabelText(/layout/i), "flat-4");

    expect(useEngineStore.getState().comparisonSingleCylinderView).toBe(false);
    expect(useEngineStore.getState().singleCylinderView).toBe(true);
  });

  it("reads the comparison slot's own current value, not engine A's", () => {
    useEngineStore.setState({
      layoutId: "inline-4",
      comparisonLayoutId: "v12-60",
    });
    render(<EngineLayoutSelector slot="comparison" />);

    const select = screen.getByLabelText(/layout/i) as HTMLSelectElement;
    expect(select.value).toBe("v12-60");
  });
});
