/**
 * Open in Freedium - background service worker.
 *
 * Opens the "What's New" changelog page when the extension is first installed
 * (a welcome view) and whenever it is updated to a new version. Uses only the
 * runtime/tabs extension APIs; no host access, no data collection.
 *
 * Note: creating a tab that points at one of the extension's own pages does
 * NOT require the "tabs" permission, so this adds no new permissions.
 */
"use strict";

const CHANGELOG_PATH = "changelog/changelog.html";

const openChangelog = (welcome) => {
  const base = chrome.runtime.getURL(CHANGELOG_PATH);
  chrome.tabs.create({ url: welcome ? `${base}?welcome=1` : base });
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    openChangelog(true);
    return;
  }

  if (details.reason === "update") {
    // Only surface the changelog when the version actually changed. This skips
    // the no-op "update" events browsers fire when reloading an unpacked build.
    const previous = details.previousVersion;
    const current = chrome.runtime.getManifest().version;
    if (previous && previous !== current) {
      openChangelog(false);
    }
  }
});
