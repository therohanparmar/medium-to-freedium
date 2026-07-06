/**
 * Open in Freedium - toolbar popup logic.
 *
 * Shows the installed version and opens the changelog in a new tab. No inline
 * scripts (extension pages enforce a strict CSP); everything is wired here.
 */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const versionEl = document.getElementById("version");
  if (versionEl) {
    versionEl.textContent = chrome.runtime.getManifest().version;
  }

  const whatsNew = document.getElementById("whats-new");
  if (whatsNew) {
    whatsNew.addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("changelog/changelog.html"),
      });
      window.close();
    });
  }
});
