import { useEffect, useState } from "react";

/**
 * Tracks which single metric's explainer is open (by `METRIC_INFO` id), for
 * one results panel/table at a time. Shared by `CalculationPanel` and
 * `ComparisonTable` so both get identical open/close/Escape behavior:
 *
 * - Toggling the currently-open metric's trigger again closes it.
 * - Opening a different metric replaces whichever was open — at most one
 *   explainer is ever open per panel/table instance.
 * - Escape closes whatever is currently open in *this* instance. Because
 *   the keydown listener is only attached while something is open (and
 *   each panel/table owns its own independent state), pressing Escape
 *   never affects an instance that has nothing open.
 */
export function useMetricInfoToggle() {
  const [openMetricId, setOpenMetricId] = useState<string | null>(null);

  useEffect(() => {
    if (openMetricId === null) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMetricId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openMetricId]);

  function toggleMetric(id: string) {
    setOpenMetricId((prev) => (prev === id ? null : id));
  }

  return { openMetricId, toggleMetric };
}
