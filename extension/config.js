// DunaSavvy extension config — single source of truth for backend URL.
// Order of precedence:
//   1. URL stored in chrome.storage.local under "duna_backend_url" (set via popup or chrome.storage)
//   2. The hardcoded default below (update when the backend host changes)
// To override at runtime without a rebuild:
//   chrome.storage.local.set({ duna_backend_url: "https://api.your-host.com" })
const DEFAULT_BACKEND_URL = "https://ghost-cart-1.preview.emergentagent.com";

let _cachedBackend = DEFAULT_BACKEND_URL;
let _resolved = false;

async function resolveBackend() {
  if (_resolved) return _cachedBackend;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const { duna_backend_url } = await chrome.storage.local.get("duna_backend_url");
      if (duna_backend_url && /^https?:\/\//.test(duna_backend_url)) _cachedBackend = duna_backend_url;
    }
  } catch (e) { /* fall back to default */ }
  _resolved = true;
  return _cachedBackend;
}

// Sync constants for callers that import them directly. These reflect the default
// until `await resolveBackend()` has run; the API helper below always awaits.
export const BACKEND_URL = DEFAULT_BACKEND_URL;
export const API = `${DEFAULT_BACKEND_URL}/api`;

// Async helpers — prefer these from background/popup/offscreen
export async function getBackend() { return await resolveBackend(); }
export async function getAPI() { return `${await resolveBackend()}/api`; }

// Platform metadata
export const PLATFORMS = {
  doordash: { label: "DoorDash", color: "#ef2a44", host: "www.doordash.com" },
  ubereats: { label: "Uber Eats", color: "#06c167", host: "www.ubereats.com" },
  grubhub: { label: "Grubhub", color: "#f63440", host: "www.grubhub.com" },
};

// Rate-limit settings to dodge bot detection on cross-platform fetches
export const FETCH_DELAY_MS = 1500;
export const FETCH_JITTER_MS = 800;
