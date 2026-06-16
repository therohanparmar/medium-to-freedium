/**
 * Medium → Freedium content script.
 *
 * Adds a "Read on Freedium" button on Medium article pages that opens the
 * current story on Freedium. Handles Medium's SPA routing so the button shows
 * only on article views and is removed on listing pages.
 */
(() => {
  "use strict";

  // Base URL is configurable from config.js; fall back to the default and
  // normalize to exactly one trailing slash.
  const DEFAULT_BASE = "https://freedium-mirror.cfd/";
  const configuredBase = window.OpenInFreediumConfig?.baseUrl;
  const FREEDIUM_BASE =
    (typeof configuredBase === "string" && configuredBase.trim()
      ? configuredBase.trim()
      : DEFAULT_BASE
    ).replace(/\/+$/, "") + "/";

  const BUTTON_ID = "m2f-freedium-button";
  const TOAST_ID = "m2f-freedium-toast";
  const TOAST_DURATION_MS = 2200;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const isFreedium = () => location.hostname.includes("freedium");

  // Medium story URLs end in a 12-char hex post id (e.g. .../title-1a2b3c4d5e6f
  // or /p/1a2b3c4d5e6f). Listing pages (feed, tags, profiles) never do.
  const isArticlePage = () => {
    const lastSegment = location.pathname.replace(/\/+$/, "").split("/").pop() || "";
    return /[0-9a-f]{12}$/.test(lastSegment);
  };

  // Use the clean canonical URL (origin + path), dropping Medium's tracking
  // query (?source=...) and any #fragment. Those extras can make Freedium 500.
  const buildFreediumUrl = () =>
    `${FREEDIUM_BASE}${location.origin}${location.pathname}`;

  const showToast = (message) => {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    void toast.offsetWidth; // reflow so the transition runs on a freshly added node
    toast.classList.add("m2f-toast--visible");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(
      () => toast.classList.remove("m2f-toast--visible"),
      TOAST_DURATION_MS,
    );
  };

  const openOnFreedium = () => {
    showToast("Opening article on Freedium…");
    window.open(buildFreediumUrl(), "_blank", "noopener,noreferrer");
  };

  const createBookIcon = () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    Object.entries({
      class: "m2f-button__icon",
      viewBox: "0 0 24 24",
      width: "18",
      height: "18",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
    }).forEach(([name, value]) => svg.setAttribute(name, value));

    for (const d of [
      "M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z",
      "M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z",
    ]) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  };

  const createButton = () => {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "m2f-button";
    button.setAttribute("aria-label", "Read this article on Freedium");
    button.title = "Read on Freedium";

    const label = document.createElement("span");
    label.className = "m2f-button__label";
    label.textContent = "Read on Freedium";

    button.append(createBookIcon(), label);
    button.addEventListener("click", openOnFreedium);
    return button;
  };

  // Adds the button on article views and removes it everywhere else. Idempotent.
  const ensureButton = () => {
    if (isFreedium() || !isArticlePage()) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }
    if (document.getElementById(BUTTON_ID) || !document.body) return;
    document.body.appendChild(createButton());
  };

  // Medium is a Next.js SPA, so the button must be re-evaluated on every route
  // change. The Navigation API is the primary signal (it catches framework
  // pushState calls); history hooks + popstate cover older engines; the
  // observer is a safety net that also re-heals the button after a re-render.
  let lastUrl = location.href;
  let debounceTimer = null;

  const scheduleEnsure = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(ensureButton, 60);
  };

  const handleLocationChange = () => {
    lastUrl = location.href;
    scheduleEnsure();
  };

  if (typeof window.navigation?.addEventListener === "function") {
    window.navigation.addEventListener("navigate", handleLocationChange);
  }

  const patchHistoryMethod = (method) => {
    const original = history[method];
    if (typeof original !== "function") return;
    history[method] = function (...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("m2f:locationchange"));
      return result;
    };
  };

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  window.addEventListener("popstate", handleLocationChange);
  window.addEventListener("m2f:locationchange", handleLocationChange);

  const observer = new MutationObserver(() => {
    const urlChanged = location.href !== lastUrl;
    const needsHeal = !document.getElementById(BUTTON_ID) && isArticlePage();
    if (!urlChanged && !needsHeal) return;

    if (urlChanged) lastUrl = location.href;
    scheduleEnsure();
  });

  const init = () => {
    ensureButton();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
