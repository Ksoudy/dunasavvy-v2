// DunaSavvy — Background service worker (the Router)
// Coordinates scraping events, virtual-cart state, and cross-platform fetches.

import { BACKEND_URL, API, PLATFORMS, FETCH_DELAY_MS, FETCH_JITTER_MS } from "./config.js";

const SESSION_KEY = "duna_session_id";

async function getSessionId() {
  const { [SESSION_KEY]: sid } = await chrome.storage.local.get(SESSION_KEY);
  if (sid) return sid;
  const newSid = crypto.randomUUID();
  await chrome.storage.local.set({ [SESSION_KEY]: newSid });
  return newSid;
}

function jitterDelay() {
  return new Promise((r) => setTimeout(r, FETCH_DELAY_MS + Math.random() * FETCH_JITTER_MS));
}

// Offscreen-document helper for cross-site fetches
let creatingOffscreen;
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument?.()) return;
  if (creatingOffscreen) return creatingOffscreen;
  creatingOffscreen = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("offscreen.html"),
    reasons: ["DOM_PARSER"],
    justification: "Cross-platform price fetch & HTML parsing for DunaSavvy comparison engine.",
  });
  await creatingOffscreen;
  creatingOffscreen = null;
}

async function pushCartToBackend(cart) {
  const sid = await getSessionId();
  try {
    const res = await fetch(`${API}/cart/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid, cart }),
    });
    return await res.json();
  } catch (e) {
    console.warn("[DunaSavvy] ingest failed", e);
    return { ok: false, error: String(e) };
  }
}

async function runComparison() {
  const sid = await getSessionId();
  const { virtual_carts = {} } = await chrome.storage.local.get("virtual_carts");
  const carts = Object.values(virtual_carts);
  if (!carts.length) {
    return { error: "No cart scraped yet. Add an item on DoorDash, Uber Eats, or Grubhub." };
  }

  const anchor = carts[0].platform;
  // Ensure all 3 platforms exist with a placeholder when missing
  const present = new Set(carts.map((c) => c.platform));
  for (const plat of Object.keys(PLATFORMS)) {
    if (!present.has(plat)) {
      carts.push({
        platform: plat,
        restaurant: carts[0].restaurant,
        address: carts[0].address,
        items: [],
        subtotal: 0, service_fee: 0, delivery_fee: 0, tax: 0,
        eta_minutes: null, available: false, auth_required: true,
      });
    }
  }

  await jitterDelay(); // simulate respectful spacing
  const res = await fetch(`${API}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sid, anchor_platform: anchor, carts }),
  });
  const json = await res.json();
  await chrome.storage.local.set({ last_comparison: json, last_comparison_ts: Date.now() });
  return json;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "SCRAPED_CART") {
        const cart = msg.cart;
        const { virtual_carts = {} } = await chrome.storage.local.get("virtual_carts");
        virtual_carts[cart.platform] = cart;
        await chrome.storage.local.set({ virtual_carts });
        await pushCartToBackend(cart);
        sendResponse({ ok: true });
      } else if (msg?.type === "RUN_COMPARE") {
        const result = await runComparison();
        sendResponse(result);
      } else if (msg?.type === "RESET_CART") {
        await chrome.storage.local.remove(["virtual_carts", "last_comparison"]);
        sendResponse({ ok: true });
      } else if (msg?.type === "GET_STATE") {
        const data = await chrome.storage.local.get(["virtual_carts", "last_comparison", "last_comparison_ts"]);
        sendResponse({ ...data, backend: BACKEND_URL });
      } else {
        sendResponse({ error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ error: String(e) });
    }
  })();
  return true; // keep channel open
});

chrome.runtime.onInstalled.addListener(async () => {
  await getSessionId();
  console.log("[DunaSavvy] installed. Backend:", BACKEND_URL);
});
