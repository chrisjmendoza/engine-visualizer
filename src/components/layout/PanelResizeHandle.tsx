import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import styles from "./PanelResizeHandle.module.css";

/** Arrow-key step, in CSS pixels (matches the units `widthPx` is expressed in). */
const STEP_PX = 16;
/** Shift+arrow step: a bigger jump for quickly reaching the ends of the range. */
const BIG_STEP_PX = 64;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export interface PanelResizeHandleProps {
  /** Committed panel width in CSS pixels — the source of truth while idle. */
  widthPx: number;
  /** Width restored on double-click, Enter, or if the range collapses. */
  defaultWidthPx: number;
  /** Minimum width the panel may ever be resized to (px). */
  minWidthPx: number;
  /**
   * Returns the current maximum width (px). A function, not a number: the
   * ceiling is ~65% of the window (see ApplicationShell), which can change
   * between the start and end of an interaction if the window itself is
   * resized, so it is re-read at the moment it's needed rather than cached.
   */
  getMaxWidthPx: () => number;
  /**
   * Fired on every intermediate step of an interaction (pointer move, each
   * key press). The caller writes this straight to a CSS custom property on
   * a ref rather than through React state, so a drag reflows the layout
   * live without re-rendering the rest of the app on every pointer event.
   */
  onLiveWidthChange: (widthPx: number) => void;
  /**
   * Fired once an interaction settles on a value (pointer up/cancel, or
   * immediately for a keyboard step, double-click, or Enter reset) — this
   * is what should become the new committed `widthPx`.
   */
  onCommit: (widthPx: number) => void;
}

/**
 * The drag handle between the viewport and the side panel in the desktop
 * two-column layout (`ApplicationShell`). Implements the ARIA "window
 * splitter" pattern: a focusable `separator` rather than a slider, since it
 * resizes the two regions either side of it rather than picking a value on
 * its own scale. `aria-valuenow/min/max` are all expressed in CSS pixels,
 * matching `widthPx`.
 *
 * Only rendered by `ApplicationShell` while the two-column split actually
 * exists (see `useIsTwoColumnLayout`) — there is nothing to drag between
 * when the layout is stacked, so this component assumes a live two-column
 * context rather than checking for one itself.
 */
export function PanelResizeHandle({
  widthPx,
  defaultWidthPx,
  minWidthPx,
  getMaxWidthPx,
  onLiveWidthChange,
  onCommit,
}: PanelResizeHandleProps) {
  // Local mirror of the width so `aria-valuenow` (and the visual position,
  // via onLiveWidthChange) can update at pointer-move rate without lifting
  // that same rate of updates into ApplicationShell's state and re-rendering
  // the viewport/controls beneath it.
  const [displayWidthPx, setDisplayWidthPx] = useState(widthPx);
  // Mutable alongside displayWidthPx so the pointer-up handler always reads
  // the latest value rather than one captured by a stale closure (setState
  // from the preceding pointermove may not have flushed yet).
  const liveWidthRef = useRef(widthPx);
  const dragOriginRef = useRef<{
    pointerX: number;
    startWidthPx: number;
  } | null>(null);

  function applyLive(next: number) {
    liveWidthRef.current = next;
    setDisplayWidthPx(next);
    onLiveWidthChange(next);
  }

  function commit(next: number) {
    applyLive(next);
    onCommit(next);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // Left button / primary touch only — a secondary click shouldn't start
    // a drag.
    if (event.button !== 0) {
      return;
    }
    // Guarded: not implemented in jsdom (component tests still exercise the
    // drag math via plain pointer events without real capture).
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragOriginRef.current = {
      pointerX: event.clientX,
      startWidthPx: liveWidthRef.current,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const origin = dragOriginRef.current;
    if (!origin) {
      return;
    }
    // The handle sits to the left of the panel: dragging left (negative
    // clientX delta) widens the panel, mirroring "pulling the divider into
    // the space it's taking over."
    const deltaPx = origin.pointerX - event.clientX;
    const next = clamp(
      origin.startWidthPx + deltaPx,
      minWidthPx,
      getMaxWidthPx(),
    );
    applyLive(next);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragOriginRef.current) {
      return;
    }
    dragOriginRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    onCommit(liveWidthRef.current);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const max = getMaxWidthPx();
    const step = event.shiftKey ? BIG_STEP_PX : STEP_PX;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = clamp(liveWidthRef.current - step, minWidthPx, max);
        break;
      case "ArrowRight":
        next = clamp(liveWidthRef.current + step, minWidthPx, max);
        break;
      case "Home":
        next = minWidthPx;
        break;
      case "End":
        next = max;
        break;
      case "Enter":
        next = clamp(defaultWidthPx, minWidthPx, max);
        break;
      default:
        return;
    }
    event.preventDefault();
    commit(next);
  }

  function handleDoubleClick() {
    commit(clamp(defaultWidthPx, minWidthPx, getMaxWidthPx()));
  }

  return (
    <div
      className={styles.handle}
      data-panel-resize-handle=""
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={Math.round(displayWidthPx)}
      aria-valuemin={Math.round(minWidthPx)}
      aria-valuemax={Math.round(getMaxWidthPx())}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
    />
  );
}
