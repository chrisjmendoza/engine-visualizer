import { useId, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useEngineStore } from "../../state/engineStore";
import { rpmSchema } from "../../engine/validation";
import { degToRad, radToDeg } from "../../engine/units";
import {
  INPUT_RANGES,
  PLAYBACK_SPEED_LABELS,
  PLAYBACK_SPEEDS,
} from "../../engine/constants";
import { formatRounded } from "../shared/formatting";
import { StrokeBadge } from "../results/StrokeBadge";
import styles from "./AnimationControls.module.css";

interface RpmFieldState {
  syncedRpm: number;
  draft: string;
  error: string | undefined;
}

/**
 * Local draft + validation-error state for one rpm field, kept in sync with
 * its committed store value — the same "adjust state during render" pattern
 * `EngineGeometryControls` uses (see there for the full rationale): a
 * successful commit snaps the field back to canonical text without an
 * extra effect-driven render pass, and it never clobbers an in-progress
 * edit on the *other* rpm field (engine A's and engine B's are independent
 * hooks, so one committing never touches the other's draft).
 */
function useRpmDraft(committedRpm: number) {
  const [state, setState] = useState<RpmFieldState>(() => ({
    syncedRpm: committedRpm,
    draft: String(committedRpm),
    error: undefined,
  }));
  if (state.syncedRpm !== committedRpm) {
    setState({
      syncedRpm: committedRpm,
      draft: String(committedRpm),
      error: undefined,
    });
  }
  return [state, setState] as const;
}

/** "At redline (9,000)" — no unit suffix, so it reads as a value the button jumps to. */
function formatRedlineValue(redlineRpm: number): string {
  return redlineRpm.toLocaleString("en-US");
}

interface RpmFieldProps {
  id: string;
  label: string;
  field: RpmFieldState;
  errorId: string;
  onChange: (rawText: string) => void;
  redlineRpm: number;
  onSetRedline: () => void;
}

/** One labeled rpm input plus its "At redline" button — reused for the
 * single shared field, and for each of the two per-engine fields. */
function RpmField({
  id,
  label,
  field,
  errorId,
  onChange,
  redlineRpm,
  onSetRedline,
}: RpmFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.rpmRow}>
        <input
          id={id}
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={INPUT_RANGES.rpm.min}
          max={INPUT_RANGES.rpm.max}
          step="any"
          value={field.draft}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={field.error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.redlineButton}
          onClick={onSetRedline}
        >
          At redline ({formatRedlineValue(redlineRpm)})
        </button>
      </div>
      {field.error ? (
        <p className={styles.error} id={errorId} role="alert">
          {field.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Play/pause, RPM (single, or per-engine while comparing and unlinked),
 * crank-angle scrub, and playback-speed controls (TECHNICAL_DESIGN.md §11,
 * §16). While playing, the slider follows the store's throttled
 * `crankAngleRad` readout (~10 Hz, §7.3) purely by subscribing to the
 * store — this component adds no animation-frame logic of its own.
 * Scrubbing calls `scrubTo`, which pauses playback and phase-locks both
 * engines to the scrubbed angle even while unlinked (resuming lets them
 * diverge again); changing RPM calls `setRpm`/`setComparisonRpm` without
 * touching the angle, so playback resumes from wherever it was.
 *
 * `playbackSpeed` only scales how fast the rendered mechanism appears to
 * move — it never changes `rpm`, so every calculated readout (mean piston
 * speed, etc.) keeps reflecting the true engine speed.
 *
 * Engine speed is per-engine plumbing (`rpm`/`comparisonRpm`/`rpmLinked` in
 * the store; the animation loop already reads all three) that had no
 * control surface until this component exposed it: while comparison mode
 * is off there is only ever one engine, so the "Link engine speeds"
 * checkbox and the second rpm field only appear once `comparisonConfig` is
 * set. Linking re-syncs engine B's angle onto engine A's immediately (the
 * store's own `setRpmLinked` does this), so re-linking never leaves the
 * two mechanisms visibly out of phase.
 */
export function AnimationControls() {
  const isPlaying = useEngineStore((state) => state.isPlaying);
  const play = useEngineStore((state) => state.play);
  const pause = useEngineStore((state) => state.pause);

  const config = useEngineStore((state) => state.config);
  const comparisonConfig = useEngineStore((state) => state.comparisonConfig);
  const isComparing = comparisonConfig !== null;

  const rpm = useEngineStore((state) => state.rpm);
  const setRpm = useEngineStore((state) => state.setRpm);
  const comparisonRpm = useEngineStore((state) => state.comparisonRpm);
  const setComparisonRpm = useEngineStore((state) => state.setComparisonRpm);
  const rpmLinked = useEngineStore((state) => state.rpmLinked);
  const setRpmLinked = useEngineStore((state) => state.setRpmLinked);

  const playbackSpeed = useEngineStore((state) => state.playbackSpeed);
  const setPlaybackSpeed = useEngineStore((state) => state.setPlaybackSpeed);

  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const scrubTo = useEngineStore((state) => state.scrubTo);

  const [rpmField, setRpmField] = useRpmDraft(rpm);
  const [comparisonRpmField, setComparisonRpmField] =
    useRpmDraft(comparisonRpm);

  function handleRpmChangeFor(
    setField: Dispatch<SetStateAction<RpmFieldState>>,
    commit: (value: number) => void,
  ) {
    return (rawText: string) => {
      setField((prev) => ({ ...prev, draft: rawText }));
      const parsed = rawText.trim() === "" ? Number.NaN : Number(rawText);
      const result = rpmSchema.safeParse(parsed);
      if (result.success) {
        // The synced-value check in useRpmDraft clears the draft/error
        // once this field's own commit lands.
        commit(result.data);
      } else {
        setField((prev) => ({
          ...prev,
          error:
            result.error.issues[0]?.message ?? "RPM must be a finite number.",
        }));
      }
    };
  }

  const handleRpmChange = handleRpmChangeFor(setRpmField, setRpm);
  const handleComparisonRpmChange = handleRpmChangeFor(
    setComparisonRpmField,
    setComparisonRpm,
  );

  function handleSetRedlineA() {
    setRpm(config.redlineRpm);
  }

  function handleSetRedlineB() {
    if (!comparisonConfig) {
      return;
    }
    // While linked, engine B has no independent rpm — jumping "to B's
    // redline" moves the one shared speed both engines run at.
    if (rpmLinked) {
      setRpm(comparisonConfig.redlineRpm);
    } else {
      setComparisonRpm(comparisonConfig.redlineRpm);
    }
  }

  function handleScrub(rawText: string) {
    const degrees = Number(rawText);
    if (!Number.isFinite(degrees)) {
      return;
    }
    scrubTo(degToRad(degrees));
  }

  const crankAngleDeg = radToDeg(crankAngleRad);

  const rpmInputId = useId();
  const rpmErrorId = useId();
  const rpmAInputId = useId();
  const rpmAErrorId = useId();
  const rpmBInputId = useId();
  const rpmBErrorId = useId();
  const linkCheckboxId = useId();
  const angleInputId = useId();
  const speedGroupId = useId();
  const speedHintId = useId();

  return (
    <div className={styles.controls}>
      {/* Two naturally short controls share a row (wrapping if the viewport
          is too narrow for both) instead of each claiming a full-width
          mobile row. */}
      <div className={styles.topRow}>
        <button
          type="button"
          className={styles.playButton}
          aria-pressed={isPlaying}
          title={`${isPlaying ? "Pause" : "Play"} (Space)`}
          aria-keyshortcuts="Space"
          onClick={() => (isPlaying ? pause() : play())}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        {!isComparing ? (
          <RpmField
            id={rpmInputId}
            label="Engine speed (RPM)"
            field={rpmField}
            errorId={rpmErrorId}
            onChange={handleRpmChange}
            redlineRpm={config.redlineRpm}
            onSetRedline={handleSetRedlineA}
          />
        ) : null}
      </div>

      {isComparing ? (
        <div className={styles.rpmSection}>
          <label className={styles.checkboxRow} htmlFor={linkCheckboxId}>
            <input
              id={linkCheckboxId}
              className={styles.checkbox}
              type="checkbox"
              checked={rpmLinked}
              onChange={(event) => setRpmLinked(event.target.checked)}
            />
            Link engine speeds
          </label>

          {rpmLinked ? (
            <>
              <RpmField
                id={rpmInputId}
                label="Engine speed (RPM) — both engines"
                field={rpmField}
                errorId={rpmErrorId}
                onChange={handleRpmChange}
                redlineRpm={config.redlineRpm}
                onSetRedline={handleSetRedlineA}
              />
              {comparisonConfig ? (
                <div className={styles.extraRedlineRow}>
                  <button
                    type="button"
                    className={styles.redlineButton}
                    onClick={handleSetRedlineB}
                  >
                    Engine B at redline (
                    {formatRedlineValue(comparisonConfig.redlineRpm)})
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <RpmField
                id={rpmAInputId}
                label="Engine A speed (RPM)"
                field={rpmField}
                errorId={rpmAErrorId}
                onChange={handleRpmChange}
                redlineRpm={config.redlineRpm}
                onSetRedline={handleSetRedlineA}
              />
              {comparisonConfig ? (
                <RpmField
                  id={rpmBInputId}
                  label="Engine B speed (RPM)"
                  field={comparisonRpmField}
                  errorId={rpmBErrorId}
                  onChange={handleComparisonRpmChange}
                  redlineRpm={comparisonConfig.redlineRpm}
                  onSetRedline={handleSetRedlineB}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor={angleInputId}>
          Crank angle
        </label>
        <div className={styles.sliderRow}>
          <input
            id={angleInputId}
            className={styles.slider}
            type="range"
            min={0}
            max={360}
            step={0.1}
            value={crankAngleDeg}
            title="Scrub crank angle (← → keys, Shift for 10°)"
            aria-keyshortcuts="ArrowLeft ArrowRight"
            onChange={(event) => handleScrub(event.target.value)}
          />
          <output
            className={styles.angleReadout}
            htmlFor={angleInputId}
            aria-live="off"
          >
            {formatRounded(crankAngleDeg, 1)}°
          </output>
        </div>
        {/*
         * The four-stroke overlay (§11's future-work note; `src/engine/cycle.ts`)
         * sits right beside the readout it extends: this 360° scrub angle is
         * only half of a four-stroke engine's 720° cycle, and the badge names
         * which half. Renders nothing unless the "Four-stroke cycle"
         * preference (`UnitSelector`) is on.
         */}
        <StrokeBadge />
      </div>

      <fieldset className={styles.speedFieldset} aria-describedby={speedHintId}>
        <legend className={styles.legend}>Playback speed</legend>
        <div className={styles.speedOptions}>
          {PLAYBACK_SPEEDS.map((speed) => {
            const optionId = `${speedGroupId}-${speed}`;
            return (
              <label
                key={speed}
                className={styles.speedOption}
                htmlFor={optionId}
              >
                <input
                  id={optionId}
                  className={styles.speedRadio}
                  type="radio"
                  name={speedGroupId}
                  value={speed}
                  checked={playbackSpeed === speed}
                  onChange={() => setPlaybackSpeed(speed)}
                />
                {PLAYBACK_SPEED_LABELS[speed]}
              </label>
            );
          })}
        </div>
        <p className={styles.hint} id={speedHintId}>
          Slows rendering only; readouts use true RPM.
        </p>
      </fieldset>
    </div>
  );
}
