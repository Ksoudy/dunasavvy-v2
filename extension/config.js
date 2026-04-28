// DunaSavvy extension config — single source of truth for backend URL.
// Replace BACKEND_URL with your deployed FastAPI URL after build.
export const BACKEND_URL = "https://650bbfe7-aacc-44f8-ae59-7c216c9526c3.preview.emergentagent.com";
export const API = `${BACKEND_URL}/api`;

// Platform metadata
export const PLATFORMS = {
  doordash: { label: "DoorDash", color: "#ef2a44", host: "www.doordash.com" },
  ubereats: { label: "Uber Eats", color: "#06c167", host: "www.ubereats.com" },
  grubhub: { label: "Grubhub", color: "#f63440", host: "www.grubhub.com" },
};

// Rate-limit settings to dodge bot detection on cross-platform fetches
export const FETCH_DELAY_MS = 1500;
export const FETCH_JITTER_MS = 800;
