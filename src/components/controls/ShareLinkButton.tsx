import { useId, useRef, useState } from "react";
import { buildShareUrl } from "../shared/shareUrl";
import styles from "./ShareLinkButton.module.css";

type CopyStatus = "idle" | "copied" | "fallback";

/** How long the "Link copied" confirmation stays visible. */
const CONFIRMATION_MS = 2000;

/**
 * Copies a link to the current engine configuration (built fresh from live
 * store state via `buildShareUrl`, not read back from the address bar, so
 * it's correct even before the debounced address-bar sync has caught up).
 *
 * `navigator.clipboard.writeText` fails silently in some environments
 * (older browsers, denied permission, a non-secure context) — when it
 * does, this falls back to a selectable read-only text field with the
 * link, rather than leaving the user with no way to get it.
 */
export function ShareLinkButton() {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const revertTimeoutRef = useRef<number | undefined>(undefined);
  const fallbackInputId = useId();

  async function handleClick() {
    const url = buildShareUrl();
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(url);
      if (revertTimeoutRef.current !== undefined) {
        window.clearTimeout(revertTimeoutRef.current);
      }
      setStatus("copied");
      revertTimeoutRef.current = window.setTimeout(() => {
        setStatus("idle");
      }, CONFIRMATION_MS);
    } catch {
      setFallbackUrl(url);
      setStatus("fallback");
    }
  }

  return (
    <div className={styles.container}>
      <button type="button" className={styles.button} onClick={handleClick}>
        Copy link
      </button>
      {/* Always present (not conditionally mounted) so assistive tech has
          already registered this live region by the time it has anything
          to announce. */}
      <p className={styles.status} aria-live="polite">
        {status === "copied" ? "Link copied" : ""}
      </p>
      {status === "fallback" ? (
        <div className={styles.fallback}>
          <label className={styles.fallbackLabel} htmlFor={fallbackInputId}>
            Couldn&apos;t copy automatically — copy this link manually:
          </label>
          <input
            id={fallbackInputId}
            ref={(element) => {
              element?.focus();
              element?.select();
            }}
            className={styles.fallbackInput}
            type="text"
            readOnly
            value={fallbackUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
    </div>
  );
}
