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
  const CARD_GROUP_CLASS = "m2f-card-actions"; // wraps the two card buttons
  const CARD_BUTTON_CLASS = "m2f-card-button"; // "read on Freedium" card button
  const CARD_COPY_CLASS = "m2f-card-copy"; // "copy Freedium link" card button
  const CARD_DONE_ATTR = "data-m2f-card";
  const TOAST_ID = "m2f-freedium-toast";
  const TOAST_DURATION_MS = 2200;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // A 12-char hex post id terminates every Medium story URL (e.g.
  // .../title-1a2b3c4d5e6f or /p/1a2b3c4d5e6f). Listing pages never end in one.
  const POST_ID_RE = /[0-9a-f]{12}$/;

  const isFreedium = () => location.hostname.includes("freedium");

  // Listing pages (feed, tags, profiles) never end in a post id; story pages do.
  const isArticlePage = () => {
    const lastSegment = location.pathname.replace(/\/+$/, "").split("/").pop() || "";
    return POST_ID_RE.test(lastSegment);
  };

  // Turn a Medium story location into its Freedium equivalent. We keep only the
  // clean canonical URL (origin + path), dropping Medium's tracking query
  // (?source=...) and any #fragment. Those extras can make Freedium 500.
  const toFreediumUrl = (origin, pathname) =>
    `${FREEDIUM_BASE}${origin}${pathname}`;

  const buildFreediumUrl = () => toFreediumUrl(location.origin, location.pathname);

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

  const openOnFreedium = (url) => {
    showToast("Opening article on Freedium…");
    window.open(url || buildFreediumUrl(), "_blank", "noopener,noreferrer");
  };

  const createBookIcon = (size = 18) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    Object.entries({
      class: "m2f-button__icon",
      viewBox: "0 0 24 24",
      width: String(size),
      height: String(size),
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

  // A clipboard/copy glyph for the "copy Freedium link" segment.
  const createCopyIcon = (size = 16) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    Object.entries({
      class: "m2f-button__copy-icon",
      viewBox: "0 0 24 24",
      width: String(size),
      height: String(size),
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
    }).forEach(([name, value]) => svg.setAttribute(name, value));

    const rect = document.createElementNS(SVG_NS, "rect");
    Object.entries({ x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" })
      .forEach(([name, value]) => rect.setAttribute(name, value));

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

    svg.append(rect, path);
    return svg;
  };

  // Copy text to the clipboard. Uses the async Clipboard API where available
  // (Medium is https, so it is), with a hidden-textarea fallback. Returns a
  // promise for whether the copy succeeded.
  const copyText = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through to the legacy path */
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  };

  // Split button: a main segment that opens Freedium plus a segment that copies
  // the article's Freedium link to the clipboard.
  const createButton = () => {
    const root = document.createElement("div");
    root.id = BUTTON_ID;
    root.className = "m2f-button";

    // --- Main action: open the article on Freedium ---
    const main = document.createElement("button");
    main.type = "button";
    main.className = "m2f-button__main";
    main.setAttribute("aria-label", "Read this article on Freedium");
    main.title = "Read on Freedium";

    const label = document.createElement("span");
    label.className = "m2f-button__label";
    label.textContent = "Read on Freedium";
    main.append(createBookIcon(), label);
    main.addEventListener("click", () => openOnFreedium());

    // --- Copy: put the Freedium link on the clipboard ---
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "m2f-button__copy";
    copy.setAttribute("aria-label", "Copy Freedium link");
    copy.title = "Copy Freedium link";
    copy.appendChild(createCopyIcon());
    copy.addEventListener("click", async (event) => {
      event.stopPropagation();
      const ok = await copyText(buildFreediumUrl());
      showToast(ok ? "Freedium link copied" : "Couldn't copy the link");
    });

    root.append(main, copy);
    return root;
  };

  // --- Listing-card buttons --------------------------------------------------
  //
  // Feed/listing pages render each story as <article data-testid="post-preview">.
  // We add a compact "Freedium" pill into each card's action toolbar so users
  // can jump straight to the free reader without opening the story first.

  // Builds one card control: a compact icon button with a tooltip label. The
  // click handler reads the story's Freedium URL from the group's dataset (set
  // in placePill) so a single URL feeds both the read and copy buttons.
  const createCardControl = (className, ariaLabel, icon, onActivate) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", ariaLabel);
    button.title = ariaLabel;

    const label = document.createElement("span");
    label.className = "m2f-card-button__label";
    label.textContent = ariaLabel;

    button.append(icon, label);
    button.addEventListener("click", (event) => {
      // The toolbar lives inside the card; stop the click from bubbling to any
      // surrounding link/handler before running the action.
      event.preventDefault();
      event.stopPropagation();
      onActivate();
    });
    return button;
  };

  // A card's action group: "Read on Freedium" plus "Copy Freedium link". Both
  // buttons read the story URL from the group's dataset so it stays in sync
  // when Medium recycles a card.
  const createCardActions = () => {
    const group = document.createElement("span");
    group.className = CARD_GROUP_CLASS;

    const read = createCardControl(
      CARD_BUTTON_CLASS,
      "Read on Freedium",
      createBookIcon(18),
      () => {
        const url = group.dataset.freediumUrl;
        if (url) openOnFreedium(url);
      },
    );

    const copy = createCardControl(
      CARD_COPY_CLASS,
      "Copy Freedium link",
      createCopyIcon(13),
      async () => {
        const url = group.dataset.freediumUrl;
        if (!url) return;
        const ok = await copyText(url);
        showToast(ok ? "Freedium link copied" : "Couldn't copy the link");
      },
    );

    group.append(read, copy);
    return group;
  };

  // Derive a story's Freedium URL from the first link in the card whose path
  // ends in a post id (the title link). Returns null for non-story cards.
  const getCardFreediumUrl = (article) => {
    for (const anchor of article.querySelectorAll("a[href]")) {
      let url;
      try {
        url = new URL(anchor.getAttribute("href"), location.origin);
      } catch {
        continue;
      }
      const lastSegment = url.pathname.replace(/\/+$/, "").split("/").pop() || "";
      if (POST_ID_RE.test(lastSegment)) {
        return toFreediumUrl(url.origin, url.pathname);
      }
    }
    return null;
  };

  // Medium splits each card's toolbar into a left cluster (claps, responses,
  // repost) and a right cluster (dislike, bookmark, more options) with a gap
  // between them. We drop the pill into that gap, i.e. right before the
  // "not interested" (dislike) button's row-level wrapper. Returns the toolbar
  // row and the child to insert before. We anchor on stable aria-labels rather
  // than Medium's churning obfuscated class names.
  const DISLIKE_SELECTOR =
    'button[aria-label="I\'m not interested in this story"]';
  const MORE_SELECTOR = 'button[aria-label="More options"]';

  const findToolbarSlot = (dislikeButton, article) => {
    let node = dislikeButton;
    while (node.parentElement && node.parentElement !== article) {
      const parent = node.parentElement;
      // The toolbar row is the first ancestor that also holds "More options";
      // `node` is then the row-level wrapper around the dislike button.
      if (parent.querySelector(MORE_SELECTOR)) {
        return { row: parent, before: node };
      }
      node = parent;
    }
    return null;
  };

  // Inserts (or refreshes) the pill inside `parent` as its last child, or, when
  // `before` is given and belongs to `parent`, just ahead of it. Idempotent and
  // self-healing across Medium's re-renders.
  const placePill = (parent, before, freediumUrl) => {
    if (!parent) return;
    let group = parent.querySelector(`:scope > .${CARD_GROUP_CLASS}`);
    if (!group) {
      group = createCardActions();
      if (before && before.parentElement === parent) {
        parent.insertBefore(group, before);
      } else {
        parent.appendChild(group);
      }
    }
    group.dataset.freediumUrl = freediumUrl; // keep fresh if a card recycles
  };

  // Injects a single Freedium pill into each feed card, at the end of the left
  // cluster (claps/responses/repost) so it hugs those icons; that cluster is
  // the sibling right before the dislike wrapper. Medium renders more than one
  // toolbar copy per card for responsive layouts, and at some widths more than
  // one is visible, so we target the visible toolbar and strip any strays to
  // avoid duplicate pills.
  const ensureCardButtons = () => {
    if (isFreedium()) return;
    for (const article of document.querySelectorAll(
      'article[data-testid="post-preview"]',
    )) {
      // Sticky: if a pill is already in place, keep exactly one and leave it be.
      // Re-evaluating/moving a placed pill is what makes it flicker, so we don't.
      const pills = article.querySelectorAll(`.${CARD_GROUP_CLASS}`);
      if (pills.length) {
        for (let i = 1; i < pills.length; i++) pills[i].remove();
        if (pills[0].isConnected) continue;
      }

      const freediumUrl = getCardFreediumUrl(article);
      if (!freediumUrl) {
        // No resolvable story link: mark as skipped so the heal check below
        // doesn't treat this card as perpetually "missing" its button.
        article.setAttribute(CARD_DONE_ATTR, "skip");
        continue;
      }

      // Prefer a visible toolbar (offsetParent is null when display:none);
      // fall back to the first copy if none report visible yet.
      const dislikeButtons = [...article.querySelectorAll(DISLIKE_SELECTOR)];
      const dislikeButton =
        dislikeButtons.find((btn) => btn.offsetParent !== null) ||
        dislikeButtons[0];

      const slot = dislikeButton && findToolbarSlot(dislikeButton, article);
      if (slot) {
        const leftCluster = slot.before.previousElementSibling;
        const target = leftCluster || slot.row; // append vs. insert in the gap
        const before = leftCluster ? null : slot.before;
        placePill(target, before, freediumUrl);
      }
      article.setAttribute(CARD_DONE_ATTR, "done");
    }
  };

  // A card needs (re)processing if we've never touched it, or if a re-render
  // wiped a button we placed. Skipped cards are left alone.
  const cardNeedsButton = (article) => {
    const state = article.getAttribute(CARD_DONE_ATTR);
    if (state === "skip") return false;
    if (state !== "done") return true;
    return !article.querySelector(`.${CARD_GROUP_CLASS}`);
  };

  // A card we already finished but whose pill a re-render just stripped. These
  // must be re-added synchronously (before paint) to avoid a visible flicker;
  // brand-new cards can wait for the debounce.
  const cardLostButton = (article) =>
    article.getAttribute(CARD_DONE_ATTR) === "done" &&
    !article.querySelector(`.${CARD_GROUP_CLASS}`);

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

  const refresh = () => {
    ensureButton();
    ensureCardButtons();
  };

  const scheduleEnsure = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, 60);
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
    const floatingNeedsHeal = !document.getElementById(BUTTON_ID) && isArticlePage();
    if (urlChanged || floatingNeedsHeal) {
      if (urlChanged) lastUrl = location.href;
      scheduleEnsure();
    }

    if (isFreedium()) return;
    const cards = [
      ...document.querySelectorAll('article[data-testid="post-preview"]'),
    ];
    // A re-render that strips a placed pill must be undone in this same callback
    // (a microtask, before the browser paints) so the pill never visibly blinks.
    // Brand-new cards from infinite scroll have no such constraint, so debounce.
    if (cards.some(cardLostButton)) {
      ensureCardButtons();
    } else if (cards.some(cardNeedsButton)) {
      scheduleEnsure();
    }
  });

  const init = () => {
    refresh();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
