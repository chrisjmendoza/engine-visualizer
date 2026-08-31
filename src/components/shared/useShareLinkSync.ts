import { useLayoutEffect } from "react";
import { decodeShareState } from "../../engine/shareLink";
import { useEngineStore } from "../../state/engineStore";
import { getShareQuery } from "./shareUrl";

/** Debounce window for writing store changes back to the address bar. */
const SYNC_DEBOUNCE_MS = 250;

/**
 * Hydrates the store from `window.location.search` once, then keeps the
 * address bar's query string in sync with the store afterward. Call this
 * exactly once, near the app root (`App.tsx`).
 *
 * Hydration runs in a layout effect (rather than a passive one) so it
 * commits before the browser paints — no flash of default state before a
 * shared link's configuration appears.
 *
 * The sync direction (store -> URL) is debounced and, more importantly,
 * only resets that debounce when the *encoded* query would actually
 * change. While playing, the store's `crankAngleRad` mirrors the
 * animation loop at ~10 Hz (§7.3) — a store change on every one of those
 * ticks — but `encodeShareState` omits the angle entirely while playing,
 * so those ticks would otherwise perpetually reset the debounce timer and
 * starve out a real pending change (e.g. an RPM edit made mid-playback).
 * Comparing against the last-seen encoded query sidesteps that: a tick
 * that doesn't change the encoded output is a no-op here, not a reason to
 * postpone the write again.
 */
export function useShareLinkSync() {
  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const partial = decodeShareState(window.location.search);
    if (Object.keys(partial).length > 0) {
      useEngineStore.getState().hydrateFromShareState(partial);
    }
    // Mount-once: must run before the sync effect below observes any
    // state, and must never re-run on later store changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let debounceHandle: number | undefined;
    // Seeded post-hydration (this effect runs after the one above), so a
    // link's own query never immediately re-triggers a write of itself.
    let lastQuery = getShareQuery();

    function flush() {
      debounceHandle = undefined;
      const query = getShareQuery();
      lastQuery = query;
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }

    const unsubscribe = useEngineStore.subscribe(() => {
      const query = getShareQuery();
      if (query === lastQuery) {
        return;
      }
      // Recorded here (not only inside `flush`), so a *later* notification
      // whose query matches this one — e.g. the next 10 Hz angle tick,
      // once the encoded output has caught up to a just-started pending
      // change — is recognized as "nothing new" and doesn't reset the
      // timer again. Without this, comparing only against the
      // last-*written* query would keep finding this same pending change
      // "different" on every subsequent tick and never let the debounce
      // actually elapse.
      lastQuery = query;
      if (debounceHandle !== undefined) {
        window.clearTimeout(debounceHandle);
      }
      debounceHandle = window.setTimeout(flush, SYNC_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (debounceHandle !== undefined) {
        window.clearTimeout(debounceHandle);
      }
    };
    // Mount-once: this effect owns its own debounce/unsubscribe lifecycle
    // entirely through the store subscription, not through dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
