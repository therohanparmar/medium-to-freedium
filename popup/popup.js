/**
 * Open in Freedium - toolbar popup logic.
 *
 * Shows the installed version and opens the changelog in a new tab. No inline
 * scripts (extension pages enforce a strict CSP); everything is wired here.
 */
"use strict";

// Sets each element's text to the matching chrome.i18n message, so the popup
// renders in whichever UI language the browser is set to.
const localize = () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.title = chrome.i18n.getMessage("extensionTitle");

  const textIds = {
    "popup-title": "extensionTitle",
    "version-label": "versionLabel",
    "popup-blurb": "popupBlurb",
    "whats-new": "whatsNew",
    "contribute-link": "contributeGithub",
    "privacy-link": "privacyPolicy",
  };
  for (const [id, messageName] of Object.entries(textIds)) {
    const el = document.getElementById(id);
    if (el) el.textContent = chrome.i18n.getMessage(messageName);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  localize();

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
