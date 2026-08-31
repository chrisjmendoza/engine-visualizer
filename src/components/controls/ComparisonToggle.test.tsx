import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComparisonToggle } from "./ComparisonToggle";
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

describe("ComparisonToggle", () => {
  it("starts as an unpressed 'Add comparison engine' button", () => {
    render(<ComparisonToggle />);

    const button = screen.getByRole("button", {
      name: /add comparison engine/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(useEngineStore.getState().comparisonConfig).toBeNull();
  });

  it("enables comparison (seeding engine B as a copy of engine A) on click", async () => {
    const user = userEvent.setup();
    render(<ComparisonToggle />);

    await user.click(
      screen.getByRole("button", { name: /add comparison engine/i }),
    );

    expect(useEngineStore.getState().comparisonConfig).toEqual(DEFAULT_CONFIG);
    const button = screen.getByRole("button", { name: /remove comparison/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("disables comparison and clears comparisonConfig on a second click", async () => {
    const user = userEvent.setup();
    render(<ComparisonToggle />);

    await user.click(
      screen.getByRole("button", { name: /add comparison engine/i }),
    );
    expect(useEngineStore.getState().comparisonConfig).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: /remove comparison/i }),
    );

    expect(useEngineStore.getState().comparisonConfig).toBeNull();
    expect(
      screen.getByRole("button", { name: /add comparison engine/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
