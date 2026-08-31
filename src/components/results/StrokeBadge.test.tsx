import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StrokeBadge } from "./StrokeBadge";
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
    crankRevolutionParity: 0,
  });
}

beforeEach(() => {
  resetStore();
});

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

describe("StrokeBadge", () => {
  it("renders nothing while the four-stroke cycle preference is off (the default)", () => {
    const { container } = render(<StrokeBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows intake at TDC (crank angle 0, parity 0)", () => {
    useEngineStore.setState({
      preferences: {
        displayUnit: "mm",
        showLabels: true,
        showCycle: true,
        uprightFlatEngines: false,
      },
      crankAngleRad: 0,
      crankRevolutionParity: 0,
    });
    render(<StrokeBadge />);

    expect(screen.getByText(/intake/i)).toBeInTheDocument();
    expect(screen.getByText(/0°\s*\/\s*720°/)).toBeInTheDocument();
  });

  it("shows compression past 180 degrees, still in the first crank revolution", () => {
    useEngineStore.setState({
      preferences: {
        displayUnit: "mm",
        showLabels: true,
        showCycle: true,
        uprightFlatEngines: false,
      },
      crankAngleRad: Math.PI + 0.1, // just past BDC
      crankRevolutionParity: 0,
    });
    render(<StrokeBadge />);

    expect(screen.getByText(/compression/i)).toBeInTheDocument();
  });

  it("shows power partway through the crank's second revolution", () => {
    useEngineStore.setState({
      preferences: {
        displayUnit: "mm",
        showLabels: true,
        showCycle: true,
        uprightFlatEngines: false,
      },
      crankAngleRad: Math.PI / 2, // 90 degrees
      crankRevolutionParity: 1, // + 360 degrees = 450 degrees of the cycle
    });
    render(<StrokeBadge />);

    expect(screen.getByText(/power/i)).toBeInTheDocument();
    expect(screen.getByText(/450°\s*\/\s*720°/)).toBeInTheDocument();
  });

  it("shows exhaust in the last quarter of the cycle", () => {
    useEngineStore.setState({
      preferences: {
        displayUnit: "mm",
        showLabels: true,
        showCycle: true,
        uprightFlatEngines: false,
      },
      crankAngleRad: Math.PI + Math.PI / 2, // 270 degrees
      crankRevolutionParity: 1, // + 360 = 630 degrees of the cycle
    });
    render(<StrokeBadge />);

    expect(screen.getByText(/exhaust/i)).toBeInTheDocument();
    expect(screen.getByText(/630°\s*\/\s*720°/)).toBeInTheDocument();
  });

  it("hides again once the preference is turned back off", () => {
    useEngineStore.setState({
      preferences: {
        displayUnit: "mm",
        showLabels: true,
        showCycle: true,
        uprightFlatEngines: false,
      },
    });
    const { container } = render(<StrokeBadge />);
    expect(screen.getByText(/four-stroke cycle/i)).toBeInTheDocument();

    act(() => {
      useEngineStore.setState({
        preferences: {
          displayUnit: "mm",
          showLabels: true,
          showCycle: false,
          uprightFlatEngines: false,
        },
      });
    });

    expect(container).toBeEmptyDOMElement();
  });
});
