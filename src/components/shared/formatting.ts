/**
 * Presentation-only number formatting for the interface layer.
 *
 * Rounding here is for display; the engine layer retains full JavaScript
 * numeric precision for every calculation (TECHNICAL_DESIGN.md §15). Never
 * feed a value rounded by these helpers back into `src/engine/`.
 */

/** Rounds to a fixed number of decimals for calculated-result readouts. */
export function formatRounded(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const factor = 10 ** decimals;
  let rounded = Math.round(value * factor) / factor;
  if (Object.is(rounded, -0)) {
    rounded = 0;
  }
  return rounded.toFixed(decimals);
}

/**
 * Rounds to at most `maxDecimals` decimals and trims trailing zeros, for
 * editable numeric inputs where "86" reads better than "86.00".
 */
export function formatTrimmed(value: number, maxDecimals: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  if (maxDecimals <= 0) {
    return String(Math.round(value));
  }
  const fixed = value.toFixed(maxDecimals);
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
}
