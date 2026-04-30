// DunaSavvy — Background service worker (the Router)
// Coordinates scraping events, virtual-cart state, cross-platform fetches,
// and the "Good Citizen" robots.txt gate.

import { BACKEND_URL, PLATFORMS, FETCH_DELAY_MS, FETCH_JITTER_MS, getAPI } from "./config.js";

const SESSION_KEY = "duna_session_id";
const ROBOTS_CACHE_KEY = "duna_robots_cache";
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;       // 24h
const USER_AGENT = "DunaSavvy";

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

// ---------- Robots.txt: Good Citizen Protocol ----------
function parseRobots(txt) {
  // Returns {disallow: string[], allow: string[]} merged from User-agent: * and DunaSavvy blocks.
  const disallow = [];
  const allow = [];
  let active = false;
  const lines = (txt || "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) { active = false; continue; }
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      const ua = val.toLowerCase();
      active = (ua === "*" || ua.includes(USER_AGENT.toLowerCase()));
    } else if (active && key === "disallow" && val) {
      disallow.push(val);
    } else if (active && key === "allow" && val) {
      allow.push(val);
    }
  }
  return { disallow, allow };
}

async function fetchRobotsFor(host) {
  try {
    const res = await fetch(`https://${host}/robots.txt`, { credentials: "omit" });
    if (!res.ok) return { disallow: [], allow: [], fetched_at: Date.now(), status: res.status };
    const txt = await res.text();
    return { ...parseRobots(txt), fetched_at: Date.now(), status: res.status };
  } catch (e) {
    return { disallow: [], allow: [], fetched_at: Date.now(), error: String(e) };
  }
}

async function ensureRobotsFresh() {
  const { [ROBOTS_CACHE_KEY]: cache = {} } = await chrome.storage.local.get(ROBOTS_CACHE_KEY);
  const now = Date.now();
  let dirty = false;
  for (const [plat, meta] of Object.entries(PLATFORMS)) {
    const entry = cache[plat];
    if (!entry || now - entry.fetched_at > ROBOTS_TTL_MS) {
      cache[plat] = await fetchRobotsFor(meta.host);
      dirty = true;
    }
  }
  if (dirty) await chrome.storage.local.set({ [ROBOTS_CACHE_KEY]: cache });
  return cache;
}

function pathMatches(rule, pathname) {
  // Minimal robots.txt prefix match with `*` and `$` support.
  if (!rule) return false;
  if (rule === "/") return true;
  // wildcard support
  if (rule.includes("*") || rule.endsWith("$")) {
    const pattern = "^" + rule.replace(/\$$/, "_END_").replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace("_END_", "$");
    return new RegExp(pattern).test(pathname);
  }
  return pathname.startsWith(rule);
}

async function isUrlAllowed(url) {
  try {
    const u = new URL(url);
    const cache = await ensureRobotsFresh();
    const platEntry = Object.entries(PLATFORMS).find(([, m]) => u.hostname.endsWith(m.host));
    if (!platEntry) return true; // not a tracked platform
    const [, ] = platEntry;
    const rules = cache[platEntry[0]] || { disallow: [], allow: [] };
    // Allow rules win ties (per spec spirit)
    const allowed = rules.allow.some((r) => pathMatches(r, u.pathname));
    if (allowed) return true;
    const blocked = rules.disallow.some((r) => pathMatches(r, u.pathname));
    return !blocked;
  } catch {
    return true;
  }
}

// ---------- Backend bridge ----------
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
    const API = await getAPI();
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

  await jitterDelay();
  const API = await getAPI();
  const res = await fetch(`${API}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sid, anchor_platform: anchor, carts }),
  });
  const json = await res.json();
  await chrome.storage.local.set({ last_comparison: json, last_comparison_ts: Date.now() });
  return json;
}

// Cross-site offscreen fetch (gated by robots.txt). Routes the message ONLY to
// the offscreen document — NOT the service worker — to avoid the bug where the
// SW's own onMessage listener catches the broadcast first and short-circuits with
// `unknown message`. We accomplish this by tagging the message with a `target`
// field that the SW listener early-returns on.
async function offscreenFetch(url) {
  if (!(await isUrlAllowed(url))) {
    return { ok: false, blocked_by: "robots.txt", url };
  }
  await ensureOffscreen();
  await jitterDelay();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "FETCH_AND_PARSE", target: "offscreen", url },
      (resp) => {
        if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
        resolve(resp || { ok: false, error: "no response" });
      }
    );
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Hard early-return on offscreen-targeted messages so the offscreen doc is the
  // sole responder. Without this, the SW would beat the offscreen reply.
  if (msg?.target === "offscreen") return false;

  (async () => {
    try {
      if (msg?.type === "SCRAPED_CART") {
        const cart = msg.cart;
        const url = sender?.tab?.url || sender?.url;
        if (url && !(await isUrlAllowed(url))) {
          sendResponse({ ok: false, blocked_by: "robots.txt" });
          return;
        }
        const { virtual_carts = {} } = await chrome.storage.local.get("virtual_carts");
        virtual_carts[cart.platform] = cart;
        await chrome.storage.local.set({ virtual_carts });
        await pushCartToBackend(cart);
        sendResponse({ ok: true });
      } else if (msg?.type === "RUN_COMPARE") {
        sendResponse(await runComparison());
      } else if (msg?.type === "NEARBY_SEARCH") {
        sendResponse(await nearbySearch(msg.lat, msg.lon, msg.radius_mi || 6));
      } else if (msg?.type === "RESTAURANT_SEARCH") {
        sendResponse(await restaurantSearch(msg.q));
      } else if (msg?.type === "RESET_CART") {
        await chrome.storage.local.remove(["virtual_carts", "last_comparison"]);
        sendResponse({ ok: true });
      } else if (msg?.type === "GET_STATE") {
        const data = await chrome.storage.local.get(["virtual_carts", "last_comparison", "last_comparison_ts", ROBOTS_CACHE_KEY]);
        sendResponse({ ...data, backend: BACKEND_URL });
      } else if (msg?.type === "OFFSCREEN_FETCH") {
        sendResponse(await offscreenFetch(msg.url));
      } else if (msg?.type === "ROBOTS_REFRESH") {
        await chrome.storage.local.remove(ROBOTS_CACHE_KEY);
        const cache = await ensureRobotsFresh();
        sendResponse({ ok: true, cache });
      } else if (msg?.type === "PING") {
        sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      } else {
        sendResponse({ error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ error: String(e) });
    }
  })();
  return true; // keep channel open
});

// External (web → extension) bridge — the dashboard at dunasavvy.com calls this
// to ask the extension to run nearby/restaurant searches "as the user."
chrome.runtime.onMessageExternal?.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "PING") return sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      if (msg?.type === "NEARBY_SEARCH") return sendResponse(await nearbySearch(msg.lat, msg.lon, msg.radius_mi || 6));
      if (msg?.type === "RESTAURANT_SEARCH") return sendResponse(await restaurantSearch(msg.q));
      sendResponse({ error: "unknown external message" });
    } catch (e) { sendResponse({ error: String(e) }); }
  })();
  return true;
});

// In production these would ask the offscreen doc to fetch the platforms'
// nearby/search endpoints. Until those scrapers are stable, we delegate to
// the FastAPI backend which returns a directory-derived response with the
// same shape.
async function nearbySearch(lat, lon, radius_mi) {
  if (typeof lat !== "number" || typeof lon !== "number") return { error: "lat/lon required" };
  await jitterDelay();
  const API = await getAPI();
  const res = await fetch(`${API}/nearby?lat=${lat}&lon=${lon}&radius_mi=${radius_mi}`);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return await res.json();
}

async function restaurantSearch(q) {
  if (!q || !q.trim()) return { error: "query required" };
  await jitterDelay();
  const API = await getAPI();
  const res = await fetch(`${API}/restaurant-search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return await res.json();
}

// Daily robots refresh via alarms (survives service-worker sleep)
chrome.runtime.onInstalled.addListener(async () => {
  await getSessionId();
  await ensureRobotsFresh();
  chrome.alarms.create("duna-robots-refresh", { periodInMinutes: 60 * 12 }); // every 12h
  console.log("[DunaSavvy] installed. Backend:", BACKEND_URL);
});

chrome.alarms?.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "duna-robots-refresh") {
    await chrome.storage.local.remove(ROBOTS_CACHE_KEY);
    await ensureRobotsFresh();
  }
});
