/**
 * Builds the current shareable URL from live store state. Shared by
 * `useShareLinkSync` (address-bar sync) and `ShareLinkButton` (copy link),
 * so both always agree on exactly what a "current share link" is —
 * computed fresh from the store each time, not read back from the address
 * bar, so it's correct even the instant before a debounced sync has
 * written it there.
 */

import { encodeShareState } from "../../engine/shareLink";
import type { ShareState } from "../../engine/shareLink";
import { useEngineStore } from "../../state/engineStore";

/** The current store state, reshaped into `ShareState`. */
export function getShareState(): ShareState {
  const state = useEngineStore.getState();
  return {
    config: state.config,
    comparisonConfig: state.comparisonConfig,
    rpm: state.rpm,
    displayUnit: state.preferences.displayUnit,
    playbackSpeed: state.playbackSpeed,
    isPlaying: state.isPlaying,
    crankAngleRad: state.crankAngleRad,
  };
}

/** The query string (no leading "?") for the current store state. */
export function getShareQuery(): string {
  return encodeShareState(getShareState());
}

/** The full, absolute current share URL (origin + path + query). */
export function buildShareUrl(): string {
  const query = getShareQuery();
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
}
