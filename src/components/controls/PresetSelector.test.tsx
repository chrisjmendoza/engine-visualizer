import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PresetSelector } from "./PresetSelector";
import { useEngineStore } from "../../state/engineStore";
import { DEFAULT_ANIMATION, DEFAULT_CONFIG } from "../../engine/constants";
import { ENGINE_PRESETS, type EnginePreset } from "../../engine/presets";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    preferences: { displayUnit: "mm", showLabels: true },
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

/**
 * Locates a preset's button by its rendered text rather than an exact
 * accessible-name match: each button's name, engine code, and layout label
 * live in separate child spans, and this project's installed
 * @testing-library/dom version matches `getByRole`'s `name` option by exact
 * string equality only (no fuzzy/substring mode), so matching against just
 * `preset.name` there would never succeed.
 */
function getPresetButton(preset: EnginePreset): HTMLElement {
  const button = screen
    .getAllByRole("button")
    .find((candidate) => candidate.textContent?.includes(preset.name));
  if (!button) {
    throw new Error(`expected a rendered button for preset "${preset.id}"`);
  }
  return button;
}

describe("PresetSelector", () => {
  it("renders a button for every preset with its name, engine code, and layout label", () => {
    render(<PresetSelector />);

    for (const preset of ENGINE_PRESETS) {
      const button = getPresetButton(preset);
      expect(button).toHaveTextContent(preset.engineCode);
      expect(button).toHaveTextContent(preset.layoutLabel);
    }
  });

  it("replaces the store config with the preset's exact millimeter values on click", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
    if (!preset) throw new Error("expected supra-2jzgte preset to exist");

    await user.click(getPresetButton(preset));

    expect(useEngineStore.getState().config).toEqual(preset.config);
  });

  it("does not touch rpm or playback state when a preset is applied", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({ rpm: 3200, isPlaying: true });
    render(<PresetSelector />);

    const preset = ENGINE_PRESETS[0];
    await user.click(getPresetButton(preset));

    expect(useEngineStore.getState().rpm).toBe(3200);
    expect(useEngineStore.getState().isPlaying).toBe(true);
  });

  it("marks the matching preset as pressed and no others", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    const first = ENGINE_PRESETS[0];
    const second = ENGINE_PRESETS[1];

    const firstButton = getPresetButton(first);
    const secondButton = getPresetButton(second);

    expect(firstButton).toHaveAttribute("aria-pressed", "false");
    expect(secondButton).toHaveAttribute("aria-pressed", "false");

    await user.click(firstButton);

    expect(firstButton).toHaveAttribute("aria-pressed", "true");
    expect(secondButton).toHaveAttribute("aria-pressed", "false");
  });

  it("shows no active preset when the store config matches none of them", () => {
    render(<PresetSelector />);

    // DEFAULT_CONFIG (86/86/143) does not match any preset's geometry.
    for (const preset of ENGINE_PRESETS) {
      expect(getPresetButton(preset)).toHaveAttribute("aria-pressed", "false");
    }
  });
});
