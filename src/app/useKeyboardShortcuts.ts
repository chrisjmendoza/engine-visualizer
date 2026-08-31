import { useEffect } from "react";
import { degToRad, normalizeAngleRad } from "../engine/units";
import { useEngineStore } from "../state/engineStore";

/** Scrub step per arrow-key press, in degrees. Shift multiplies this. */
const SCRUB_STEP_DEG = 1;
/** Scrub step with Shift held, in degrees (§19: a coarser jog for quick scanning). */
const SCRUB_STEP_DEG_SHIFT = 10;

/** Tag names that own their own key behavior and must not be intercepted. */
const FORM_TAG_NAMES = new Set([
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "BUTTON",
  "OPTION",
]);

/**
 * True when the event's target is a form control (or inside a
 * contentEditable region) that should keep its native key handling —
 * Space activating a focused button, arrow keys moving a text caret or
 * nudging a native range/number input, etc. (§19).
 *
 * Checked via a `contenteditable` attribute match on the target or an
 * ancestor (contentEditable is inherited) rather than the DOM's own
 * `isContentEditable` property: that property is unimplemented in jsdom
 * (always `undefined`), which would make this branch untestable, while an
 * attribute-based `closest()` match is exactly how a real browser resolves
 * it too.
 */
function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) {
    return true;
  }
  return FORM_TAG_NAMES.has(target.tagName);
}

/**
 * True when the event comes from inside a modal dialog (the About dialog,
 * or any future one). A modal captures the user's attention and its own key
 * handling; scrubbing the crank or toggling playback behind an open modal
 * would be invisible, surprising state mutation (§19).
 */
function isDialogTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('dialog, [role="dialog"]') !== null
  );
}

/**
 * Global keyboard shortcuts for playback and scrubbing (§19 accessibility
 * mindset): `Space` toggles play/pause, `ArrowLeft`/`ArrowRight` scrub the
 * crank angle by one degree (ten with `Shift`). Mount exactly once, near the
 * app root (`App.tsx`) — same pattern as `useShareLinkSync`.
 *
 * Ignores the keydown entirely when it targets a form control or
 * contentEditable element (so focused inputs, selects, buttons, and
 * checkboxes keep their native behavior) or when a modifier other than
 * Shift is held (so browser/OS shortcuts like Ctrl+Space are untouched).
 * `preventDefault` is called only once a key is actually going to be
 * handled, so Space's page-scroll is suppressed only for the toggle it
 * triggers, never speculatively.
 *
 * Reads the store via `getState()`/direct actions rather than subscribing,
 * so this hook itself never rerenders — it is pure event-listener
 * plumbing, matching `useShareLinkSync`'s shape.
 *
 * Known limitation: an arrow press *during playback* nudges from
 * `crankAngleRad`, which the animation loop only mirrors at
 * READOUT_SYNC_HZ, so it can be up to ~100 ms of rotation stale — at high
 * rpm, whole revolutions. The mechanism therefore appears to jump rather
 * than step by one degree. That jump is not introduced here: stopping
 * playback by any means already snaps the mechanism to the same mirrored
 * angle (`readPausedAngles`), because the store, not the loop, owns the
 * angle while paused. Fixing it properly means flushing the loop's live
 * angle into the store as playback stops, which has to be reconciled with
 * `scrubTo` setting an explicit angle at the same moment — a change to
 * pause semantics app-wide, deliberately not made as a side effect of
 * adding shortcuts.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (isFormTarget(event.target) || isDialogTarget(event.target)) {
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        const { isPlaying, play, pause } = useEngineStore.getState();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const stepDeg = event.shiftKey ? SCRUB_STEP_DEG_SHIFT : SCRUB_STEP_DEG;
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const { crankAngleRad, scrubTo } = useEngineStore.getState();
        const nextAngleRad = normalizeAngleRad(
          crankAngleRad + direction * degToRad(stepDeg),
        );
        scrubTo(nextAngleRad);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
