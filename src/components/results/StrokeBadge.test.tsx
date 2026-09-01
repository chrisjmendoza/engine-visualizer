import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StrokeBadge } from "./StrokeBadge";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    engineFamily: "piston",
    preferences: {
      displayUnit: "mm",
      showLabels: true,
      showCycle: false,
      uprightFlatEngines: false,
    },
    rpm: DEFAULT_ANIMATION.rpm,
    isPlaying: false,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
    crankRevolutionIndex: 0,
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
      crankRevolutionIndex: 0,
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
      crankRevolutionIndex: 0,
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
      crankRevolutionIndex: 1, // + 360 degrees = 450 degrees of the cycle
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
      crankRevolutionIndex: 1, // + 360 = 630 degrees of the cycle
    });
    render(<StrokeBadge />);

    expect(screen.getByText(/exhaust/i)).toBeInTheDocument();
    expect(screen.getByText(/630°\s*\/\s*720°/)).toBeInTheDocument();
  });

  it("reads the four-stroke parity as `% 2` of the loop's mod-6 revolution index", () => {
    // The loop's counter runs 0..5 so one counter can serve both engine
    // families; the badge must see 3 and 5 as the *second* crank revolution
    // exactly as it sees 1, and 2 and 4 as the first exactly as it sees 0.
    for (const [index, expected] of [
      [0, /0°\s*\/\s*720°/],
      [1, /360°\s*\/\s*720°/],
      [2, /0°\s*\/\s*720°/],
      [3, /360°\s*\/\s*720°/],
      [4, /0°\s*\/\s*720°/],
      [5, /360°\s*\/\s*720°/],
    ] as const) {
      cleanup();
      useEngineStore.setState({
        preferences: {
          displayUnit: "mm",
          showLabels: true,
          showCycle: true,
          uprightFlatEngines: false,
        },
        crankAngleRad: 0,
        crankRevolutionIndex: index,
      });
      render(<StrokeBadge />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    }
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

  it("renders nothing while engine A is rotary, even with the preference on (§27, piston-only for now)", () => {
    useEngineStore.setState({
      engineFamily: "rotary",
      preferences: {
        displayUnit: "mm",
        showLabels: true,
        showCycle: true,
        uprightFlatEngines: false,
      },
      crankAngleRad: 0,
      crankRevolutionIndex: 0,
    });
    const { container } = render(<StrokeBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
