/**
 * Robust helper to open external URLs. Handles the common failure modes:
 *  - Sandboxed iframes that silently swallow `target="_blank"` clicks
 *  - Popup blockers requiring an explicit user-gesture `window.open`
 *  - Referrer/opener leaks (uses `noopener,noreferrer`)
 *
 * IMPORTANT: when running inside an iframe (e.g. the Emergent dashboard preview)
 * we must NEVER fall back to `window.location.assign` — that would navigate the
 * app's own iframe away and appear as "the app stopped working". Instead, when
 * both popup and top-navigation are blocked we log and give up gracefully so
 * the app itself is preserved.
 *
 * Fallback chain:
 *   1. window.open(url, '_blank')          — preferred (opens a new tab)
 *   2. window.top.location.assign(url)     — if popups are fully blocked and we
 *                                            are allowed to break out of the frame
 *   3a. (iframe context) console.warn      — silently give up; DO NOT self-navigate
 *   3b. (top-level context) window.location.assign(url) — safe: no iframe to lose
 */
export function openExternal(url: string): void {
  // Try to open in a new tab. NOTE: we intentionally do NOT pass "noopener" in the
  // features string here — Chromium (spec-compliant) returns `null` from
  // `window.open` when `noopener` is set, even on success, which would make the
  // truthy check below always fail and destructively fall through. Instead we
  // null out `opener` on the returned WindowProxy for the same security
  // guarantee, without losing our success signal.
  try {
    const win = window.open(url, "_blank");
    if (win) {
      try {
        (win as Window & { opener: unknown }).opener = null;
      } catch {
        /* cross-origin — the new window is already isolated */
      }
      return;
    }
  } catch {
    /* swallow — sandboxed iframes throw */
  }

  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    // Accessing window.top itself may throw cross-origin — that means we ARE framed.
    inIframe = true;
  }

  try {
    const top = window.top;
    if (top && top !== window.self) {
      top.location.assign(url);
      return;
    }
  } catch {
    /* cross-origin top access blocked — fall through */
  }

  if (inIframe) {
    // We're inside a restrictive iframe (e.g. dashboard preview with a strict sandbox).
    // Navigating `window.location` would replace the app itself. Prefer to do nothing
    // and let the user open the link in a new tab manually.
    // eslint-disable-next-line no-console
    console.warn(
      "[external-link] External navigation blocked by iframe sandbox. Open the app in its own tab to follow this link:",
      url,
    );
    return;
  }

  // Top-level document — safe to navigate current tab as the last resort.
  window.location.assign(url);
}

/** Convenience: React onClick handler that opens the URL externally. */
export function openExternalHandler(url: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the user open in a new tab via middle-click / ctrl+click / cmd+click.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openExternal(url);
  };
}
