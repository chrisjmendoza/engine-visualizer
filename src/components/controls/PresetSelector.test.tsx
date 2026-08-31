import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { PresetSelector } from "./PresetSelector";
import { useEngineStore } from "../../state/engineStore";
import {
  DEFAULT_ANIMATION,
  DEFAULT_CONFIG,
  DEFAULT_PLAYBACK_SPEED,
} from "../../engine/constants";
import { DEFAULT_LAYOUT_ID } from "../../engine/engineLayout";
import { ENGINE_PRESETS, type EnginePreset } from "../../engine/presets";

function resetStore() {
  useEngineStore.setState({
    config: { ...DEFAULT_CONFIG },
    comparisonConfig: null,
    layoutId: DEFAULT_LAYOUT_ID,
    comparisonLayoutId: DEFAULT_LAYOUT_ID,
    singleCylinderView: true,
    comparisonSingleCylinderView: true,
    preferences: { displayUnit: "mm", showLabels: true, showCycle: false },
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

/** Every brand present in the fixture data, derived rather than hardcoded
 * so this file keeps working as more cars/brands are added. */
const BRANDS = Array.from(new Set(ENGINE_PRESETS.map((p) => p.brand))).sort();

/**
 * Locates a brand button. Brand buttons are the only ones with
 * `aria-expanded` (preset buttons have `aria-pressed` instead), so that
 * attribute disambiguates them without depending on exact text.
 */
function getBrandButton(brand: string): HTMLElement {
  const button = screen
    .getAllByRole("button")
    .find(
      (candidate) =>
        candidate.hasAttribute("aria-expanded") &&
        candidate.textContent?.includes(brand),
    );
  if (!button) {
    throw new Error(`expected a brand button for "${brand}"`);
  }
  return button;
}

/** Expands `brand`'s panel if it isn't already expanded. */
async function expandBrand(user: UserEvent, brand: string) {
  const button = getBrandButton(brand);
  if (button.getAttribute("aria-expanded") !== "true") {
    await user.click(button);
  }
}

/**
 * Locates a preset's button by its rendered text (each button's name,
 * engine code, and layout label live in separate child spans, so an exact
 * accessible-name match against just `preset.name` would never succeed),
 * expanding its brand first since preset buttons only exist in the DOM
 * while their brand is expanded.
 */
async function getPresetButton(
  user: UserEvent,
  preset: EnginePreset,
): Promise<HTMLElement> {
  await expandBrand(user, preset.brand);
  const button = screen
    .getAllByRole("button")
    .find(
      (candidate) =>
        candidate.hasAttribute("aria-pressed") &&
        candidate.textContent?.includes(preset.name),
    );
  if (!button) {
    throw new Error(`expected a rendered button for preset "${preset.id}"`);
  }
  return button;
}

describe("PresetSelector", () => {
  it("renders one button per brand, alphabetically, collapsed by default", () => {
    render(<PresetSelector />);

    for (const brand of BRANDS) {
      const button = getBrandButton(brand);
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
    // DEFAULT_CONFIG (86/86/143) matches no preset, so nothing auto-expands
    // and no preset button exists yet anywhere in the document.
    for (const preset of ENGINE_PRESETS) {
      expect(screen.queryByText(preset.name)).not.toBeInTheDocument();
    }
  });

  it("shows a count badge on each brand button, visible even collapsed", () => {
    render(<PresetSelector />);

    for (const brand of BRANDS) {
      const count = ENGINE_PRESETS.filter((p) => p.brand === brand).length;
      expect(getBrandButton(brand)).toHaveTextContent(String(count));
    }
  });

  it("shows only the expanded brand's cars, hiding every other brand's", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    const [brandToExpand, ...otherBrands] = BRANDS;
    await user.click(getBrandButton(brandToExpand));

    for (const preset of ENGINE_PRESETS.filter(
      (p) => p.brand === brandToExpand,
    )) {
      expect(screen.getByText(preset.name)).toBeInTheDocument();
    }
    for (const brand of otherBrands) {
      for (const preset of ENGINE_PRESETS.filter((p) => p.brand === brand)) {
        expect(screen.queryByText(preset.name)).not.toBeInTheDocument();
      }
    }
  });

  it("expands exactly one brand at a time, switching when a different brand is clicked", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    const [firstBrand, secondBrand] = BRANDS;
    await user.click(getBrandButton(firstBrand));
    expect(getBrandButton(firstBrand)).toHaveAttribute("aria-expanded", "true");

    await user.click(getBrandButton(secondBrand));
    expect(getBrandButton(secondBrand)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(getBrandButton(firstBrand)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("collapses the expanded brand when its own button is clicked again", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    const [brand] = BRANDS;
    await user.click(getBrandButton(brand));
    expect(getBrandButton(brand)).toHaveAttribute("aria-expanded", "true");

    await user.click(getBrandButton(brand));
    expect(getBrandButton(brand)).toHaveAttribute("aria-expanded", "false");
  });

  it("auto-expands the matching brand when the slot's config already matches a preset", () => {
    const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
    if (!preset) throw new Error("expected supra-2jzgte preset to exist");

    useEngineStore.setState({ config: preset.config });
    render(<PresetSelector />);

    expect(getBrandButton(preset.brand)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(preset.name)).toBeInTheDocument();
  });

  it("renders a button for every preset (once its brand is expanded) with its name, engine code, and layout label", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    for (const preset of ENGINE_PRESETS) {
      const button = await getPresetButton(user, preset);
      expect(button).toHaveTextContent(preset.engineCode);
      expect(button).toHaveTextContent(preset.layoutLabel);
    }
  });

  it("replaces the store config with the preset's exact millimeter values on click", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
    if (!preset) throw new Error("expected supra-2jzgte preset to exist");

    await user.click(await getPresetButton(user, preset));

    expect(useEngineStore.getState().config).toEqual(preset.config);
  });

  it("does not touch rpm or playback state when a preset is applied", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({ rpm: 3200, isPlaying: true });
    render(<PresetSelector />);

    const preset = ENGINE_PRESETS[0];
    await user.click(await getPresetButton(user, preset));

    expect(useEngineStore.getState().rpm).toBe(3200);
    expect(useEngineStore.getState().isPlaying).toBe(true);
  });

  it("sets layoutId to the preset's real layout when it selects one (§24a)", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({ layoutId: "v8-cross" });
    render(<PresetSelector />);

    const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
    if (!preset) throw new Error("expected supra-2jzgte preset to exist");
    expect(preset.layoutId).toBe("inline-6");

    await user.click(await getPresetButton(user, preset));

    expect(useEngineStore.getState().layoutId).toBe("inline-6");
  });

  it("applies a V preset's real V layout, not a single-cylinder fallback (§24a)", async () => {
    const user = userEvent.setup();
    // Start from a different layout so the change is visibly exercised, not
    // just coincidentally already right.
    useEngineStore.setState({ layoutId: "inline-4" });
    render(<PresetSelector />);

    const preset = ENGINE_PRESETS.find((p) => p.id === "corvette-c6-ls3");
    if (!preset) throw new Error("expected corvette-c6-ls3 preset to exist");
    expect(preset.layoutId).toBe("v8-cross");

    await user.click(await getPresetButton(user, preset));

    expect(useEngineStore.getState().layoutId).toBe("v8-cross");
  });

  it("never touches the cylinder view — studying one cylinder survives picking a preset (§24a)", async () => {
    const user = userEvent.setup();
    useEngineStore.setState({ singleCylinderView: true });
    render(<PresetSelector />);

    const preset = ENGINE_PRESETS.find((p) => p.id === "corvette-z06-c6-ls7");
    if (!preset)
      throw new Error("expected corvette-z06-c6-ls7 preset to exist");

    const button = await getPresetButton(user, preset);
    await user.click(button);

    // The architecture became the LS7's real one, the view did not move, and
    // the preset still reads as selected: you are looking at one cylinder of
    // a V8, and the interface says so.
    expect(useEngineStore.getState().layoutId).toBe("v8-cross");
    expect(useEngineStore.getState().singleCylinderView).toBe(true);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("applies the layout to the comparison slot only, leaving engine A's alone", async () => {
    act(() => {
      useEngineStore.getState().enableComparison();
    });
    const user = userEvent.setup();
    render(<PresetSelector slot="comparison" />);

    const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
    if (!preset) throw new Error("expected supra-2jzgte preset to exist");

    await user.click(await getPresetButton(user, preset));

    expect(useEngineStore.getState().comparisonLayoutId).toBe("inline-6");
    expect(useEngineStore.getState().layoutId).toBe(DEFAULT_LAYOUT_ID);
  });

  it("marks the matching preset as pressed and no others in the same brand", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    const sameBrandPresets = ENGINE_PRESETS.filter(
      (p) => p.brand === ENGINE_PRESETS[0].brand,
    );
    const [first, second] = sameBrandPresets;
    if (!second) {
      throw new Error(
        "expected the first preset's brand to have at least two cars for this test",
      );
    }

    const firstButton = await getPresetButton(user, first);
    const secondButton = await getPresetButton(user, second);

    expect(firstButton).toHaveAttribute("aria-pressed", "false");
    expect(secondButton).toHaveAttribute("aria-pressed", "false");

    await user.click(firstButton);

    expect(firstButton).toHaveAttribute("aria-pressed", "true");
    expect(secondButton).toHaveAttribute("aria-pressed", "false");
  });

  it("shows no active preset when the store config matches none of them", async () => {
    const user = userEvent.setup();
    render(<PresetSelector />);

    // DEFAULT_CONFIG (86/86/143) does not match any preset's geometry.
    for (const preset of ENGINE_PRESETS) {
      expect(await getPresetButton(user, preset)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  describe("active state tracks the layout, not just geometry (§24a)", () => {
    it("is active immediately after selecting a multi-cylinder preset", async () => {
      const user = userEvent.setup();
      render(<PresetSelector />);

      const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
      if (!preset) throw new Error("expected supra-2jzgte preset to exist");
      expect(preset.layoutId).toBe("inline-6");

      const button = await getPresetButton(user, preset);
      await user.click(button);

      expect(button).toHaveAttribute("aria-pressed", "true");
    });

    it("stops being active once the layout is changed away from the preset's own", async () => {
      const user = userEvent.setup();
      render(<PresetSelector />);

      const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
      if (!preset) throw new Error("expected supra-2jzgte preset to exist");

      const button = await getPresetButton(user, preset);
      await user.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");

      // Simulates switching to a different architecture in
      // EngineLayoutSelector: the geometry is untouched, only the layout
      // changes.
      act(() => {
        useEngineStore.getState().setLayoutId("v8-cross");
      });

      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    it("stays active for a V preset once its own V layout has been applied", async () => {
      const user = userEvent.setup();
      render(<PresetSelector />);

      const preset = ENGINE_PRESETS.find((p) => p.id === "corvette-c6-ls3");
      if (!preset) throw new Error("expected corvette-c6-ls3 preset to exist");
      expect(preset.layoutId).toBe("v8-cross");

      const button = await getPresetButton(user, preset);
      await user.click(button);

      // Clicking committed both the geometry and the layout, so the two
      // halves of the active check agree and the preset reads as selected.
      expect(useEngineStore.getState().layoutId).toBe("v8-cross");
      expect(button).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("comparison slot", () => {
    it("applies a preset to comparisonConfig (engine B) only, leaving config (engine A) untouched", async () => {
      act(() => {
        useEngineStore.getState().enableComparison();
      });
      const user = userEvent.setup();
      render(<PresetSelector slot="comparison" />);

      const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
      if (!preset) throw new Error("expected supra-2jzgte preset to exist");

      await user.click(await getPresetButton(user, preset));

      expect(useEngineStore.getState().comparisonConfig).toEqual(preset.config);
      expect(useEngineStore.getState().config).toEqual(DEFAULT_CONFIG);
    });

    it("marks a preset pressed against its own slot's config, independent of the other slot", async () => {
      const preset = ENGINE_PRESETS[0];
      act(() => {
        useEngineStore.getState().enableComparison(preset.config);
        // enableComparison seeds comparisonLayoutId from engine A's
        // current layout (DEFAULT_LAYOUT_ID, from resetStore), not from the
        // preset
        // being seeded directly into engine B here — set it to match the
        // preset's own real layout so this test's geometry-matching intent
        // isn't confounded by the layout check (PresetSelector marks a
        // preset active only when both agree, see its isActive comment).
        useEngineStore.setState({
          comparisonLayoutId: preset.layoutId ?? DEFAULT_LAYOUT_ID,
        });
      });
      const user = userEvent.setup();
      render(<PresetSelector slot="comparison" />);

      expect(await getPresetButton(user, preset)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("auto-expands independently per slot instance, without affecting the other slot's expansion", () => {
      const preset = ENGINE_PRESETS.find((p) => p.id === "supra-2jzgte");
      if (!preset) throw new Error("expected supra-2jzgte preset to exist");

      act(() => {
        useEngineStore.getState().enableComparison(preset.config);
      });

      // Two independent instances, as App.tsx renders while comparing.
      const { unmount: unmountPrimary } = render(
        <PresetSelector slot="primary" />,
      );
      // Engine A (DEFAULT_CONFIG) matches nothing, so nothing auto-expands.
      for (const brand of BRANDS) {
        expect(getBrandButton(brand)).toHaveAttribute("aria-expanded", "false");
      }
      unmountPrimary();

      render(<PresetSelector slot="comparison" />);
      // Engine B matches the Supra preset, so Toyota auto-expands here.
      expect(getBrandButton(preset.brand)).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
  });
});
