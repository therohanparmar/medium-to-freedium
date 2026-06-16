/**
 * Open in Freedium - transient-error recovery (runs on Freedium pages).
 *
 * The Freedium mirror sometimes returns a 5xx on a cold render that succeeds on
 * reload. This script reads the navigation's HTTP status and, if it was a server
 * error, reloads a limited number of times - then stops so it can never loop.
 *
 * Privacy: uses only a per-tab sessionStorage counter; nothing is collected.
 */
(() => {
  "use strict";

  const MAX_RETRIES = 2;
  const BACKOFF_MS = 800;
  const COUNTER_KEY = "oif-retry-count";

  // responseStatus is part of Navigation Timing (Chromium 109+). Where it is
  // unavailable (e.g. Firefox), we can't safely decide, so we do nothing.
  const navEntry = performance.getEntriesByType("navigation")[0];
  const status = navEntry && navEntry.responseStatus;
  if (typeof status !== "number" || status === 0) return;

  if (status >= 500) {
    const attempts = Number(sessionStorage.getItem(COUNTER_KEY) || "0");
    if (attempts < MAX_RETRIES) {
      sessionStorage.setItem(COUNTER_KEY, String(attempts + 1));
      // Brief backoff so the server has a moment to recover / warm its cache.
      setTimeout(() => location.reload(), BACKOFF_MS);
    }
    // At the retry cap we stop and leave the error page visible.
    return;
  }

  // Page loaded fine - reset the counter for this tab.
  sessionStorage.removeItem(COUNTER_KEY);
})();
