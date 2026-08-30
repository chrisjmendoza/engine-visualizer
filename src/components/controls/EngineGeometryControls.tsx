import { useId, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useEngineStore } from "../../state/engineStore";
import { validateConfig } from "../../engine/validation";
import { inToMm, mmToIn } from "../../engine/units";
import type { CrankMechanismConfig, DisplayUnit } from "../../engine/types";
import { formatTrimmed } from "../shared/formatting";
import styles from "./EngineGeometryControls.module.css";

type ConfigField = keyof CrankMechanismConfig;

const FIELD_ORDER: ConfigField[] = ["boreMm", "strokeMm", "rodLengthMm"];

const FIELD_LABEL: Record<ConfigField, string> = {
  boreMm: "Bore",
  strokeMm: "Stroke",
  rodLengthMm: "Connecting-rod length",
};

function toDisplayValue(mm: number, unit: DisplayUnit): number {
  return unit === "in" ? mmToIn(mm) : mm;
}

function toMillimeters(displayValue: number, unit: DisplayUnit): number {
  return unit === "in" ? inToMm(displayValue) : displayValue;
}

function decimalsForUnit(unit: DisplayUnit): number {
  return unit === "in" ? 3 : 2;
}

function formatField(mm: number, unit: DisplayUnit): string {
  return formatTrimmed(toDisplayValue(mm, unit), decimalsForUnit(unit));
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
function useFieldDraft(committedMm: number, unit: DisplayUnit) {
  const syncKey = `${committedMm}|${unit}`;
  const [state, setState] = useState<FieldDraftState>(() => ({
    syncKey,
    draft: formatField(committedMm, unit),
    error: undefined,
  }));

  if (state.syncKey !== syncKey) {
    setState({
      syncKey,
      draft: formatField(committedMm, unit),
      error: undefined,
    });
  }

  return [state, setState] as const;
}

/**
 * Bore, stroke, and connecting-rod length inputs (TECHNICAL_DESIGN.md §16).
 *
 * Each field keeps a local draft string so the user can type freely. A draft
 * is converted to millimeters and checked against the full configuration via
 * `validateConfig` (§13) on every change; it is committed to the store the
 * moment the resulting configuration is valid, and left uncommitted —
 * with the mechanical-terms message from the offending `ValidationIssue`
 * shown next to *that* field, which may differ from the field the user is
 * typing in (e.g. shrinking the stroke can invalidate an unchanged rod
 * length) — otherwise. Invalid values never reach the store.
 */
export function EngineGeometryControls() {
  const config = useEngineStore((state) => state.config);
  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);
  const setConfig = useEngineStore((state) => state.setConfig);

  const [boreState, setBoreState] = useFieldDraft(config.boreMm, displayUnit);
  const [strokeState, setStrokeState] = useFieldDraft(
    config.strokeMm,
    displayUnit,
  );
  const [rodState, setRodState] = useFieldDraft(
    config.rodLengthMm,
    displayUnit,
  );

  const fieldStates: Record<ConfigField, FieldDraftState> = {
    boreMm: boreState,
    strokeMm: strokeState,
    rodLengthMm: rodState,
  };
  const fieldSetters: Record<
    ConfigField,
    Dispatch<SetStateAction<FieldDraftState>>
  > = {
    boreMm: setBoreState,
    strokeMm: setStrokeState,
    rodLengthMm: setRodState,
  };

  const boreErrorId = useId();
  const strokeErrorId = useId();
  const rodErrorId = useId();
  const errorIds: Record<ConfigField, string> = {
    boreMm: boreErrorId,
    strokeMm: strokeErrorId,
    rodLengthMm: rodErrorId,
  };

  function handleFieldChange(field: ConfigField, rawText: string) {
    fieldSetters[field]((prev) => ({ ...prev, draft: rawText }));

    const parsed = rawText.trim() === "" ? Number.NaN : Number(rawText);
    const mmValue = toMillimeters(parsed, displayUnit);
    const candidate = { ...config, [field]: mmValue } as CrankMechanismConfig;
    const result = validateConfig(candidate);

    if (result.ok) {
      // The field's own hook clears its draft/error once `config` updates.
      setConfig({ [field]: mmValue } as Partial<CrankMechanismConfig>);
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

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Engine geometry</legend>
      {FIELD_ORDER.map((field) => {
        const inputId = `${field}-input-${errorIds[field]}`;
        const error = fieldStates[field].error;
        return (
          <div className={styles.field} key={field}>
            <label className={styles.label} htmlFor={inputId}>
              {FIELD_LABEL[field]} ({unitSuffix})
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
