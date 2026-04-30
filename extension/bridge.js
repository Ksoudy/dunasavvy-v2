// DunaSavvy bridge — injected on dunasavvy.com and the preview origin.
// Exposes the extension's ID to the page so it can talk back via
// chrome.runtime.sendMessage(EXT_ID, …). Also relays window.postMessage events
// to the service worker for browsers that don't support externally_connectable
// (e.g. some Edge/Brave configurations).

(function () {
  const EXT_ID = chrome.runtime.id;
  const VERSION = chrome.runtime.getManifest?.().version || "1.0";

  // Inject a small marker so the page knows the extension is installed.
  const flag = document.createElement("meta");
  flag.name = "dunasavvy-extension";
  flag.content = `${EXT_ID}|${VERSION}`;
  (document.head || document.documentElement).appendChild(flag);

  // Also dispatch an event so React can react instantly without polling.
  window.dispatchEvent(new CustomEvent("dunasavvy:extension-ready", { detail: { extensionId: EXT_ID, version: VERSION } }));

  // postMessage relay — page → extension
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const data = e.data;
    if (!data || data.source !== "dunasavvy-page" || !data.id) return;
    chrome.runtime.sendMessage(data.payload, (resp) => {
      const err = chrome.runtime.lastError?.message;
      window.postMessage({ source: "dunasavvy-extension", id: data.id, response: resp, error: err }, "*");
    });
  });
})();
