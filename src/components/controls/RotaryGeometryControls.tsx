import { useId, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useEngineStore } from "../../state/engineStore";
import { validateRotaryConfig } from "../../engine/rotaryValidation";
import { ROTARY_ROTOR_COUNTS } from "../../engine/rotaryConstants";
import { isRotaryRotorCount } from "../../engine/rotaryValidation";
import { inToMm, mmToIn } from "../../engine/units";
import type { RotaryConfig } from "../../engine/rotaryTypes";
import type { DisplayUnit } from "../../engine/types";
import { formatTrimmed } from "../shared/formatting";
import {
  resolveSlotFamily,
  resolveSlotRotaryConfig,
  resolveSlotRotorCount,
} from "../shared/configSlot";
import type { ConfigSlot } from "../shared/configSlot";
import styles from "./RotaryGeometryControls.module.css";

type RotaryField = keyof RotaryConfig;

const FIELD_ORDER: RotaryField[] = [
  "generatingRadiusMm",
  "eccentricityMm",
  "rotorWidthMm",
  "compressionRatio",
  "redlineRpm",
];

const FIELD_LABEL: Record<RotaryField, string> = {
  generatingRadiusMm: "Generating radius (R)",
  eccentricityMm: "Eccentricity (e)",
  rotorWidthMm: "Rotor width (b)",
  compressionRatio: "Compression ratio",
  redlineRpm: "Redline",
};

/** Fields whose unit is fixed, unaffected by the mm/in display toggle — same split as `EngineGeometryControls`. */
const UNITLESS_FIELDS = new Set<RotaryField>([
  "compressionRatio",
  "redlineRpm",
]);

function isLengthField(field: RotaryField): boolean {
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
  field: RotaryField,
  value: number,
  unit: DisplayUnit,
): string {
  if (!isLengthField(field)) {
    return formatTrimmed(value, 1);
  }
  return formatTrimmed(toDisplayValue(value, unit), decimalsForUnit(unit));
}

interface FieldDraftState {
  syncKey: string;
  draft: string;
  error: string | undefined;
}

/**
 * Local draft + validation-error state for one rotary geometry field, kept in
 * sync with its committed millimeter value and the display unit — the exact
 * same "adjust state during render" pattern `EngineGeometryControls` uses
 * (see there for the full rationale); this is its rotary twin, not a
 * different design.
 */
function useFieldDraft(
  field: RotaryField,
  committedValue: number,
  unit: DisplayUnit,
) {
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

export interface RotaryGeometryControlsProps {
  /**
   * Which engine this instance edits: `"primary"` (engine A,
   * `store.rotaryConfig`) or `"comparison"` (engine B,
   * `store.comparisonRotaryConfig`). Defaults to `"primary"`.
   */
  slot?: ConfigSlot;
}

/**
 * Rotor-count select, and generating-radius/eccentricity/rotor-width/
 * compression-ratio/redline inputs for one rotary slot (TECHNICAL_DESIGN.md
 * §27) — the rotary analog of `EngineGeometryControls`, shown instead of it
 * once a slot's `EngineFamilySelector` is switched to rotary.
 *
 * Validation runs through `validateRotaryConfig` exactly the way
 * `EngineGeometryControls` runs through `validateConfig`: every edit is
 * checked against the FULL candidate configuration, committed the moment it
 * is valid, and left uncommitted — with the cross-field `R > 3e` message
 * surfaced against `generatingRadiusMm` (the field `rotaryValidation.ts`
 * reports it against) — otherwise. That message is this family's equivalent
 * of the piston panel's rod-vs-stroke rejection: a shrunk eccentricity or an
 * shrunk generating radius can each invalidate a configuration that was
 * previously fine, so the surfaced error can land on a field the user isn't
 * even editing, exactly as it does for bore/stroke/rod.
 *
 * Rotor count is a separate, always-valid three-way select — 1, 2, or 3 —
 * rather than free text, since `RotaryRotorCount` is a closed set with
 * defined phasing (`ROTARY_ROTOR_PHASES`); there is no invalid rotor count to
 * reject. Picking a count is an architecture change, exactly like
 * `EngineLayoutSelector`'s layout picker: it never touches crank angle or
 * playback (§11.1).
 */
export function RotaryGeometryControls({
  slot = "primary",
}: RotaryGeometryControlsProps) {
  const engineFamily = useEngineStore((state) => state.engineFamily);
  const comparisonEngineFamily = useEngineStore(
    (state) => state.comparisonEngineFamily,
  );
  const slotFamily = resolveSlotFamily(
    slot,
    engineFamily,
    comparisonEngineFamily,
  );

  const rotaryConfig = useEngineStore((state) => state.rotaryConfig);
  const comparisonRotaryConfig = useEngineStore(
    (state) => state.comparisonRotaryConfig,
  );
  const slotConfig = resolveSlotRotaryConfig(
    slot,
    rotaryConfig,
    comparisonRotaryConfig,
  );

  const rotaryRotorCount = useEngineStore((state) => state.rotaryRotorCount);
  const comparisonRotaryRotorCount = useEngineStore(
    (state) => state.comparisonRotaryRotorCount,
  );
  const slotRotorCount = resolveSlotRotorCount(
    slot,
    rotaryRotorCount,
    comparisonRotaryRotorCount,
  );

  const displayUnit = useEngineStore((state) => state.preferences.displayUnit);
  const setRotaryConfig = useEngineStore((state) => state.setRotaryConfig);
  const setComparisonRotaryConfig = useEngineStore(
    (state) => state.setComparisonRotaryConfig,
  );
  const commitSlot =
    slot === "comparison" ? setComparisonRotaryConfig : setRotaryConfig;
  const setRotaryRotorCount = useEngineStore(
    (state) => state.setRotaryRotorCount,
  );
  const setComparisonRotaryRotorCount = useEngineStore(
    (state) => state.setComparisonRotaryRotorCount,
  );
  const commitRotorCount =
    slot === "comparison" ? setComparisonRotaryRotorCount : setRotaryRotorCount;

  const [radiusState, setRadiusState] = useFieldDraft(
    "generatingRadiusMm",
    slotConfig.generatingRadiusMm,
    displayUnit,
  );
  const [eccentricityState, setEccentricityState] = useFieldDraft(
    "eccentricityMm",
    slotConfig.eccentricityMm,
    displayUnit,
  );
  const [widthState, setWidthState] = useFieldDraft(
    "rotorWidthMm",
    slotConfig.rotorWidthMm,
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

  const fieldStates: Record<RotaryField, FieldDraftState> = {
    generatingRadiusMm: radiusState,
    eccentricityMm: eccentricityState,
    rotorWidthMm: widthState,
    compressionRatio: ratioState,
    redlineRpm: redlineState,
  };
  const fieldSetters: Record<
    RotaryField,
    Dispatch<SetStateAction<FieldDraftState>>
  > = {
    generatingRadiusMm: setRadiusState,
    eccentricityMm: setEccentricityState,
    rotorWidthMm: setWidthState,
    compressionRatio: setRatioState,
    redlineRpm: setRedlineState,
  };

  const radiusErrorId = useId();
  const eccentricityErrorId = useId();
  const widthErrorId = useId();
  const ratioErrorId = useId();
  const redlineErrorId = useId();
  const errorIds: Record<RotaryField, string> = {
    generatingRadiusMm: radiusErrorId,
    eccentricityMm: eccentricityErrorId,
    rotorWidthMm: widthErrorId,
    compressionRatio: ratioErrorId,
    redlineRpm: redlineErrorId,
  };
  const rotorCountSelectId = useId();

  function handleFieldChange(field: RotaryField, rawText: string) {
    fieldSetters[field]((prev) => ({ ...prev, draft: rawText }));

    const parsed = rawText.trim() === "" ? Number.NaN : Number(rawText);
    const mmValue = isLengthField(field)
      ? toMillimeters(parsed, displayUnit)
      : parsed;
    const candidate = {
      ...slotConfig,
      [field]: mmValue,
    } as RotaryConfig;
    const result = validateRotaryConfig(candidate);

    if (result.ok) {
      commitSlot({ [field]: mmValue } as Partial<RotaryConfig>);
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

  function handleRotorCountChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = Number(event.target.value);
    if (isRotaryRotorCount(value)) {
      commitRotorCount(value);
    }
  }

  const unitSuffix = displayUnit === "in" ? "in" : "mm";

  function fieldSuffix(field: RotaryField): string {
    if (isLengthField(field)) {
      return unitSuffix;
    }
    return field === "redlineRpm" ? "rpm" : ":1";
  }

  // This component is only ever mounted for a rotary slot (`RotaryPresetSelector`
  // and this share that gate in `EnginePanel`), but the guard keeps it inert
  // rather than misleading if that invariant is ever broken by a future change.
  if (slotFamily !== "rotary") {
    return null;
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Rotary geometry</legend>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={rotorCountSelectId}>
          Rotor count
        </label>
        <select
          id={rotorCountSelectId}
          className={styles.select}
          value={slotRotorCount}
          onChange={handleRotorCountChange}
        >
          {ROTARY_ROTOR_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count} {count === 1 ? "rotor" : "rotors"}
            </option>
          ))}
        </select>
      </div>
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
