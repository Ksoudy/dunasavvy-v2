// Offscreen document — used for parsing fetched HTML from competitor platforms
// without breaking site CSP. Listens for FETCH_AND_PARSE messages from the
// service worker and returns serialized DOM snippets.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Only respond to messages explicitly targeted at the offscreen document.
  if (msg?.type !== "FETCH_AND_PARSE" || msg?.target !== "offscreen") return false;
  (async () => {
    try {
      const res = await fetch(msg.url, { credentials: "include" });
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      sendResponse({ ok: true, status: res.status, title: doc.title, bodyText: doc.body?.innerText?.slice(0, 4000) || "" });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
