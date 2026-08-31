import { useId, useState } from "react";
import { useEngineStore } from "../../state/engineStore";
import { rpmSchema } from "../../engine/validation";
import { degToRad, radToDeg } from "../../engine/units";
import { PLAYBACK_SPEED_LABELS, PLAYBACK_SPEEDS } from "../../engine/constants";
import { formatRounded } from "../shared/formatting";
import styles from "./AnimationControls.module.css";

/**
 * Play/pause, RPM, crank-angle scrub, and playback-speed controls
 * (TECHNICAL_DESIGN.md §11, §16). While playing, the slider follows the
 * store's throttled `crankAngleRad` readout (~10 Hz, §7.3) purely by
 * subscribing to the store — this component adds no animation-frame logic
 * of its own. Scrubbing calls `scrubTo`, which pauses playback per the
 * store's documented semantics; changing RPM calls `setRpm` without
 * touching the angle, so playback resumes from wherever it was.
 *
 * `playbackSpeed` only scales how fast the rendered mechanism appears to
 * move — it never changes `rpm`, so every calculated readout (mean piston
 * speed, etc.) keeps reflecting the true engine speed.
 */
export function AnimationControls() {
  const isPlaying = useEngineStore((state) => state.isPlaying);
  const play = useEngineStore((state) => state.play);
  const pause = useEngineStore((state) => state.pause);

  const rpm = useEngineStore((state) => state.rpm);
  const setRpm = useEngineStore((state) => state.setRpm);

  const playbackSpeed = useEngineStore((state) => state.playbackSpeed);
  const setPlaybackSpeed = useEngineStore((state) => state.setPlaybackSpeed);

  const crankAngleRad = useEngineStore((state) => state.crankAngleRad);
  const scrubTo = useEngineStore((state) => state.scrubTo);

  // Local draft state, derived from the committed store value during render
  // (rather than a `useEffect`) so a successful commit snaps the field back
  // to its canonical text without an extra effect-driven render pass.
  const [rpmField, setRpmField] = useState(() => ({
    syncedRpm: rpm,
    draft: String(rpm),
    error: undefined as string | undefined,
  }));
  if (rpmField.syncedRpm !== rpm) {
    setRpmField({ syncedRpm: rpm, draft: String(rpm), error: undefined });
  }
  const rpmDraft = rpmField.draft;
  const rpmError = rpmField.error;

  const rpmInputId = useId();
  const rpmErrorId = useId();
  const angleInputId = useId();
  const speedGroupId = useId();
  const speedHintId = useId();

  function handleRpmChange(rawText: string) {
    setRpmField((prev) => ({ ...prev, draft: rawText }));
    const parsed = rawText.trim() === "" ? Number.NaN : Number(rawText);
    const result = rpmSchema.safeParse(parsed);
    if (result.success) {
      // The synced-value check above clears the draft/error once committed.
      setRpm(result.data);
    } else {
      setRpmField((prev) => ({
        ...prev,
        error:
          result.error.issues[0]?.message ?? "RPM must be a finite number.",
      }));
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
          onClick={() => (isPlaying ? pause() : play())}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={rpmInputId}>
            Engine speed (RPM)
          </label>
          <input
            id={rpmInputId}
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            step="any"
            value={rpmDraft}
            aria-invalid={rpmError ? true : undefined}
            aria-describedby={rpmError ? rpmErrorId : undefined}
            onChange={(event) => handleRpmChange(event.target.value)}
          />
          {rpmError ? (
            <p className={styles.error} id={rpmErrorId} role="alert">
              {rpmError}
            </p>
          ) : null}
        </div>
      </div>

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
