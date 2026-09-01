import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { RotaryPresetSelector } from "./RotaryPresetSelector";
import { useEngineStore } from "../../state/engineStore";
import { ROTARY_ENGINE_PRESETS } from "../../engine/rotaryPresets";
import {
  DEFAULT_ROTARY_CONFIG,
  DEFAULT_ROTARY_ROTOR_COUNT,
} from "../../engine/rotaryConstants";

function resetStore() {
  useEngineStore.setState({
    engineFamily: "rotary",
    comparisonEngineFamily: "piston",
    rotaryConfig: { ...DEFAULT_ROTARY_CONFIG },
    comparisonRotaryConfig: { ...DEFAULT_ROTARY_CONFIG },
    rotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,
    comparisonRotaryRotorCount: DEFAULT_ROTARY_ROTOR_COUNT,
  });
}

beforeEach(() => {
  resetStore();
});

// This project's Vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach(cleanup) never registers;
// unmount explicitly so each test starts from an empty document.
afterEach(cleanup);

function presetById(id: string) {
  const preset = ROTARY_ENGINE_PRESETS.find((entry) => entry.id === id);
  if (!preset) {
    throw new Error(`Fixture preset '${id}' missing from the rotary roster`);
  }
  return preset;
}

/** Expands the preset's brand group and returns its own button. */
async function getPresetButton(
  user: UserEvent,
  name: string,
): Promise<HTMLElement> {
  // Preset names also contain "Mazda", so find the brand toggle by its
  // aria-expanded attribute rather than by name.
  const brandToggle = screen
    .getAllByRole("button")
    .find((candidate) => candidate.hasAttribute("aria-expanded"));
  if (brandToggle?.getAttribute("aria-expanded") === "false") {
    await user.click(brandToggle);
  }
  const button = screen
    .getAllByRole("button")
    .find(
      (candidate) =>
        candidate.hasAttribute("aria-pressed") &&
        candidate.textContent?.includes(name),
    );
  if (!button) {
    throw new Error(`No preset button for '${name}'`);
  }
  return button;
}

describe("RotaryPresetSelector", () => {
  it("commits the preset's config and rotor count on click", async () => {
    const user = userEvent.setup();
    render(<RotaryPresetSelector />);
    const cosmo = presetById("20b-rew");

    await user.click(await getPresetButton(user, cosmo.name));

    expect(useEngineStore.getState().rotaryConfig).toEqual(cosmo.config);
    expect(useEngineStore.getState().rotaryRotorCount).toBe(cosmo.rotorCount);
  });

  it("presses exactly one preset among those sharing Mazda's reused trochoid", async () => {
    // The 13B-REW and the Renesis have identical R/e/b AND rotor count —
    // only compression ratio and redline tell them apart. A geometry-only
    // match pressed both buttons at once (owner-reported); full-config
    // matching is what makes them distinguishable as selections.
    const user = userEvent.setup();
    render(<RotaryPresetSelector />);
    const rx7 = presetById("13b-rew");
    const rx8 = presetById("13b-msp-renesis");

    await user.click(await getPresetButton(user, rx7.name));
    expect(await getPresetButton(user, rx7.name)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await getPresetButton(user, rx8.name)).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(await getPresetButton(user, rx8.name));
    expect(await getPresetButton(user, rx8.name)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await getPresetButton(user, rx7.name)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("never presses two presets at once, for any selection in the roster", async () => {
    const user = userEvent.setup();
    render(<RotaryPresetSelector />);

    for (const preset of ROTARY_ENGINE_PRESETS) {
      await user.click(await getPresetButton(user, preset.name));
      const pressed = screen
        .getAllByRole("button")
        .filter(
          (candidate) => candidate.getAttribute("aria-pressed") === "true",
        );
      expect(pressed).toHaveLength(1);
      expect(pressed[0].textContent).toContain(preset.name);
    }
  });

  it("unpresses a preset once any distinguishing field is edited away", async () => {
    const user = userEvent.setup();
    render(<RotaryPresetSelector />);
    const rx7 = presetById("13b-rew");

    await user.click(await getPresetButton(user, rx7.name));
    useEngineStore.getState().setRotaryConfig({
      ...rx7.config,
      compressionRatio: rx7.config.compressionRatio + 0.5,
    });

    expect(await getPresetButton(user, rx7.name)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
