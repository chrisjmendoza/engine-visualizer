import { useId, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useEngineStore } from "../../state/engineStore";
import { validateConfig } from "../../engine/validation";
import { inToMm, mmToIn } from "../../engine/units";
import type { CrankMechanismConfig, DisplayUnit } from "../../engine/types";
import { formatTrimmed } from "../shared/formatting";
import { resolveSlotConfig } from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./EngineGeometryControls.module.css";

type ConfigField = keyof CrankMechanismConfig;

const FIELD_ORDER: ConfigField[] = [
  "boreMm",
  "strokeMm",
  "rodLengthMm",
  "compressionRatio",
  "redlineRpm",
];

const FIELD_LABEL: Record<ConfigField, string> = {
  boreMm: "Bore",
  strokeMm: "Stroke",
  rodLengthMm: "Connecting-rod length",
  compressionRatio: "Compression ratio",
  redlineRpm: "Redline",
};

/** Fields whose unit is fixed, unaffected by the mm/in display toggle. */
const UNITLESS_FIELDS = new Set<ConfigField>([
  "compressionRatio",
  "redlineRpm",
]);

/** Length fields display in the selected unit; ratios and RPM are not. */
function isLengthField(field: ConfigField): boolean {
  return !UNITLESS_FIELDS.has(field);
}

function toDisplayValue(mm: number, unit: DisplayUnit): number {
  return unit === "in" ? mmToIn(mm) : mm;
}

function toMillimeters(displayValue: number, unit: DisplayUnit): number {
  return unit === "in" ? inToMm(displayValue) : displayValue;
}

function decimalsForUnit(unit: DisplayUnit): number {
  return unit === "in" ? 3 : 2;
}

function formatField(
  field: ConfigField,
  value: number,
  unit: DisplayUnit,
): string {
  if (!isLengthField(field)) {
    return formatTrimmed(value, 1);
  }
  return formatTrimmed(toDisplayValue(value, unit), decimalsForUnit(unit));
}

interface FieldDraftState {
  /** Identifies the committed (mm, unit) pair this draft was derived from. */
  syncKey: string;
  draft: string;
  error: string | undefined;
}

/**
 * Local draft + validation-error state for one geometry field, kept in sync
 * with its committed millimeter value and the display unit.
 *
 * A field's committed mm value only ever changes when that field's own edit
 * succeeds (each store commit touches a single field), so deriving the reset
 * from `committedMm`/`unit` here — rather than a `useEffect` — can never
 * clobber an in-progress, not-yet-valid edit on a *different* field. This is
 * React's documented "adjust state during render" pattern: the guarded
 * `setState` call below runs synchronously in the render body, so it never
 * triggers the effect-driven cascading-render warning a `useEffect` would.
 */
function useFieldDraft(
  field: ConfigField,
  committedValue: number,
  unit: DisplayUnit,
) {
  // Dimensionless fields ignore the display unit, so a unit switch neither
  // reformats them nor clears an in-progress edit.
  const syncKey = isLengthField(field)
    ? `${committedValue}|${unit}`
    : `${committedValue}`;
  const [state, setState] = useState<FieldDraftState>(() => ({
    syncKey,
    draft: formatField(field, committedValue, unit),
    error: undefined,
  }));

  if (state.syncKey !== syncKey) {
    setState({
      syncKey,
      draft: formatField(field, committedValue, unit),
      error: undefined,
    });
  }

  return [state, setState] as const;
}

export interface EngineGeometryControlsProps {
  /**
   * Which engine this instance edits: `"primary"` (engine A, `store.config`)
   * or `"comparison"` (engine B, `store.comparisonConfig`). Defaults to
   * `"primary"` so existing, non-comparison usage is unaffected.
   */
  slot?: ConfigSlot;
}

/**
 * Bore, stroke, connecting-rod length, compression-ratio, and redline inputs
 * (TECHNICAL_DESIGN.md §16). The first three display in the selected unit;
 * compression ratio and redline are unaffected by the unit toggle.
 *
 * Each field keeps a local draft string so the user can type freely. A draft
 * is converted to millimeters and checked against the full configuration via
 * `validateConfig` (§13) on every change; it is committed to the store the
 * moment the resulting configuration is valid, and left uncommitted —
 * with the mechanical-terms message from the offending `ValidationIssue`
 * shown next to *that* field, which may differ from the field the user is
 * typing in (e.g. shrinking the stroke can invalidate an unchanged rod
 * length) — otherwise. Invalid values never reach the store. The validation
 * flow is identical for both slots; only which config is read and which
 * setter a successful edit commits through differs.
 */
export function EngineGeometryControls({
  slot = "primary",
}: EngineGeometryControlsProps) {
  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const slotConfig = resolveSlotConfig(slot, config, comparisonConfig);
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);
  const setConfig = useEngineStore((state) => state.setConfig);
  const setComparisonConfig = useEngineStore(
    (state) => state.setComparisonConfig,
  );
  const commitSlot = slot === "comparison" ? setComparisonConfig : setConfig;

  const [boreState, setBoreState] = useFieldDraft(
    "boreMm",
    slotConfig.boreMm,
    displayUnit,
  );
  const [strokeState, setStrokeState] = useFieldDraft(
    "strokeMm",
    slotConfig.strokeMm,
    displayUnit,
  );
  const [rodState, setRodState] = useFieldDraft(
    "rodLengthMm",
    slotConfig.rodLengthMm,
    displayUnit,
  );
  const [ratioState, setRatioState] = useFieldDraft(
    "compressionRatio",
    slotConfig.compressionRatio,
    displayUnit,
  );
  const [redlineState, setRedlineState] = useFieldDraft(
    "redlineRpm",
    slotConfig.redlineRpm,
    displayUnit,
  );

  const fieldStates: Record<ConfigField, FieldDraftState> = {
    boreMm: boreState,
    strokeMm: strokeState,
    rodLengthMm: rodState,
    compressionRatio: ratioState,
    redlineRpm: redlineState,
  };
  const fieldSetters: Record<
    ConfigField,
    Dispatch<SetStateAction<FieldDraftState>>
  > = {
    boreMm: setBoreState,
    strokeMm: setStrokeState,
    rodLengthMm: setRodState,
    compressionRatio: setRatioState,
    redlineRpm: setRedlineState,
  };

  const boreErrorId = useId();
  const strokeErrorId = useId();
  const rodErrorId = useId();
  const ratioErrorId = useId();
  const redlineErrorId = useId();
  const errorIds: Record<ConfigField, string> = {
    boreMm: boreErrorId,
    strokeMm: strokeErrorId,
    rodLengthMm: rodErrorId,
    compressionRatio: ratioErrorId,
    redlineRpm: redlineErrorId,
  };

  function handleFieldChange(field: ConfigField, rawText: string) {
    fieldSetters[field]((prev) => ({ ...prev, draft: rawText }));

    const parsed = rawText.trim() === "" ? Number.NaN : Number(rawText);
    const mmValue = isLengthField(field)
      ? toMillimeters(parsed, displayUnit)
      : parsed;
    const candidate = {
      ...slotConfig,
      [field]: mmValue,
    } as CrankMechanismConfig;
    const result = validateConfig(candidate);

    if (result.ok) {
      // The field's own hook clears its draft/error once the slot's config
      // updates.
      commitSlot({ [field]: mmValue } as Partial<CrankMechanismConfig>);
      return;
    }

    for (const otherField of FIELD_ORDER) {
      const issue = result.issues.find((item) => item.field === otherField);
      if (otherField === field || issue) {
        fieldSetters[otherField]((prev) => ({
          ...prev,
          error: issue?.message,
        }));
      }
    }
  }

  const unitSuffix = displayUnit === "in" ? "in" : "mm";

  function fieldSuffix(field: ConfigField): string {
    if (isLengthField(field)) {
      return unitSuffix;
    }
    return field === "redlineRpm" ? "rpm" : ":1";
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Engine geometry</legend>
      {FIELD_ORDER.map((field) => {
        const inputId = `${field}-input-${errorIds[field]}`;
        const error = fieldStates[field].error;
        return (
          <div className={styles.field} key={field}>
            <label className={styles.label} htmlFor={inputId}>
              {FIELD_LABEL[field]} ({fieldSuffix(field)})
            </label>
            <input
              id={inputId}
              className={styles.input}
              type="number"
              inputMode="decimal"
              step="any"
              value={fieldStates[field].draft}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorIds[field] : undefined}
              onChange={(event) => handleFieldChange(field, event.target.value)}
            />
            {error ? (
              <p className={styles.error} id={errorIds[field]} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
