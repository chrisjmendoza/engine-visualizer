import { useEngineStore } from "../../state/engineStore";
import styles from "./ComparisonToggle.module.css";

/**
 * Turns side-by-side comparison mode on and off. Enabling it seeds engine B
 * (`comparisonConfig`) as a copy of engine A (`config`) via
 * `enableComparison()`; disabling it clears `comparisonConfig` back to
 * `null` via `disableComparison()`. Both engines keep sharing RPM, playback
 * state, and crank angle — only geometry can differ between them.
 */
export function ComparisonToggle() {
  const isComparing = useEngineStore(
    (state) => state.comparisonConfig !== null,
  );
  const enableComparison = useEngineStore((state) => state.enableComparison);
  const disableComparison = useEngineStore((state) => state.disableComparison);

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={isComparing}
      onClick={() => (isComparing ? disableComparison() : enableComparison())}
    >
      {isComparing ? "Remove comparison" : "Add comparison engine"}
    </button>
  );
}
