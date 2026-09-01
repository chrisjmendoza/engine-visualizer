import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EngineFamilySelector } from "./EngineFamilySelector";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";
import {
  DEFAULT_ROTARY_CONFIG,
  DEFAULT_ROTARY_ROTOR_COUNT,
} from "../../engine/rotaryConstants";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    engineFamily: "piston",
    comparisonEngineFamily: "piston",
    rotaryConfig: { ...DEFAULT_ROTARY_CONFIG },
    comparisonRotaryConfig: { ...DEFAULT_ROTARY_CONFIG },
    rotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,
    comparisonRotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,
    rpm: DEFAULT_ANIMATION.rpm,
    isPlaying: false,
    crankAngleRad: DEFAULT_ANIMATION.crankAngleRad,
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(cleanup);

function getSwitch(): HTMLElement {
  return screen.getByRole("switch");
}

describe("EngineFamilySelector", () => {
  it("is a real switch, unchecked while the family is piston (the default)", () => {
    render(<EngineFamilySelector />);

    const control = getSwitch();
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(control).toHaveAccessibleName("Rotary engine family");
  });

  it("reads as checked once the family is rotary", () => {
    useEngineStore.setState({ engineFamily: "rotary" });
    render(<EngineFamilySelector />);

    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("keeps the same accessible name in both states", () => {
    const { rerender } = render(<EngineFamilySelector />);
    expect(getSwitch()).toHaveAccessibleName("Rotary engine family");

    useEngineStore.setState({ engineFamily: "rotary" });
    rerender(<EngineFamilySelector />);
    expect(getSwitch()).toHaveAccessibleName("Rotary engine family");
  });

  it("shows both option labels regardless of state", () => {
    render(<EngineFamilySelector />);

    expect(screen.getByText("Piston")).toBeInTheDocument();
    expect(screen.getByText("Rotary")).toBeInTheDocument();
  });

  it("toggles the family on click, without touching crank angle or playback, or either family's own geometry", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({
      crankAngleRad: 1.23,
      isPlaying: true,
      rotaryConfig: { ...DEFAULT_ROTARY_CONFIG, eccentricityMm: 17 },
    });
    render(<EngineFamilySelector />);

    await user.click(getSwitch());

    const state = useEngineStore.getState();
    expect(state.engineFamily).toBe("rotary");
    expect(state.crankAngleRad).toBe(1.23);
    expect(state.isPlaying).toBe(true);
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(state.rotaryConfig.eccentricityMm).toBe(17);
  });

  it("toggles back again", async () => {
    const user = userEvent.setup();
    render(<EngineFamilySelector />);

    await user.click(getSwitch());
    expect(useEngineStore.getState().engineFamily).toBe("rotary");

    await user.click(getSwitch());
    expect(useEngineStore.getState().engineFamily).toBe("piston");
  });

  it("is reachable and operable from the keyboard, with Space and Enter", async () => {
    const user = userEvent.setup();
    render(<EngineFamilySelector />);

    await user.tab();
    expect(getSwitch()).toHaveFocus();

    await user.keyboard(" ");
    expect(useEngineStore.getState().engineFamily).toBe("rotary");

    await user.keyboard("{Enter}");
    expect(useEngineStore.getState().engineFamily).toBe("piston");
  });

  it("reads and writes the comparison slot's own family, independent of engine A", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    useEngineStore.setState({
      engineFamily: "piston",
      comparisonEngineFamily: "rotary",
    });
    const user = userEvent.setup();
    render(<EngineFamilySelector slot="comparison" />);

    expect(getSwitch()).toHaveAttribute("aria-checked", "true");

    await user.click(getSwitch());

    expect(useEngineStore.getState().comparisonEngineFamily).toBe("piston");
    expect(useEngineStore.getState().engineFamily).toBe("piston");
  });

  it("leaves engine B's family alone when engine A's is switched", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    const user = userEvent.setup();
    render(<EngineFamilySelector />);

    await user.click(getSwitch());

    expect(useEngineStore.getState().engineFamily).toBe("rotary");
    expect(useEngineStore.getState().comparisonEngineFamily).toBe("piston");
  });
});
