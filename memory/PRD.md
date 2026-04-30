# DunaSavvy — Product Requirements (Living Doc)

## Original Problem Statement
Build a Chrome Extension (Manifest V3) that acts as a real-time price-comparison engine across DoorDash, Uber Eats, and Grubhub.

- Context-aware scraping (anchor address + restaurant)
- Cross-platform "Ghost" Cart via Offscreen Documents
- Fuzzy item matching
- Total Landed Cost (Subtotal + Service Fee + Delivery Fee + Tax)
- Anti-Gouging Monitor (>10% over median)
- Address validation, rate-limit-aware fetches, auth re-prompt

## Architecture (decided 2026-02)
**Hybrid**: Chrome MV3 extension (scraper/eyes) + FastAPI backend (brain) + React dashboard (live demo).

### Backend (`/app/backend/server.py`)
- `GET  /api/health`
- `POST /api/compare` — primary engine; computes landed cost, gouging, winner
- `POST /api/fuzzy-match` — Claude Sonnet 4.5 via Emergent LLM key (fallback to token-overlap)
- `POST /api/cart/ingest` — extension uploads scraped cart
- `GET  /api/cart/{session_id}` — retrieve stored carts
- `GET  /api/demo-comparison` — sample 3-platform comparison
- `POST /api/demo-comparison?scenario=<gouging|address_mismatch|auth_required>`
- Mongo collections: `comparisons`, `virtual_cart`

### Extension (`/app/extension/`)
- `manifest.json` (MV3, host perms for 3 sites)
- `background.js` service worker — router
- `content.js` multi-site scraper with fallback selectors
- `offscreen.html/js` for cross-site fetch
- `popup/popup.{html,css,js}` 3-column UI
- `config.js` BACKEND_URL
- icons 16/48/128 generated

### Frontend (`/app/frontend/`)
- Single-page React dashboard demonstrating engine live
- Sections: Hero, Features, Engine (3-col + winner glow + gouging panel), Ghost Cart table, Install instructions
- Scenario switcher: default | gouging | address_mismatch | auth_required
- Branding: Savvy Teal `#0d9488`, Alert Amber `#f59e0b`, Winner Green `#22c55e`
- Typography: Plus Jakarta Sans (body) + JetBrains Mono (numbers)

## What's Implemented (2026-02)
- ✅ **Nominatim autosuggest + auto-fire nearby (2026-02-30)** — Hero search hits `nominatim.openstreetmap.org`; clicking a suggestion OR pressing Enter auto-fires `/api/nearby` (and `/api/search`). Restaurant mode calls `/api/restaurant-search`. Results render in `NearbyResults` grid with distance or match-score badges.
- ✅ **Extension bridge detection** — `App` listens for `dunasavvy:extension-ready` event + `<meta name="dunasavvy-extension">` marker from `extension/bridge.js`; shows `[data-testid='extension-detected']` "Extension active" pill when present. When installed, `fetchNearby` prefers `chrome.runtime.sendMessage(EXT_ID, {type:'NEARBY_SEARCH'|'RESTAURANT_SEARCH',...})` and falls back to the backend.
- ✅ **Backend endpoints** — `GET /api/nearby?lat&lon&radius_mi&limit` (distance-sorted directory) and `GET /api/restaurant-search?q&limit` (token Jaccard + substring boost).

- ✅ Backend with all 9 endpoints + Mongo persistence
- ✅ AI fuzzy matching via Emergent LLM key (Claude Sonnet 4.5) with graceful fallback
- ✅ Live `/api/demo-fuzzy-match` button in dashboard ("Run AI match")
- ✅ Live `/api/scraper-health` selector diagnostics (HEAD probes + freshness)
- ✅ Gouging detection (token-Jaccard grouping + median + 10% threshold)
- ✅ Total landed cost calculation
- ✅ Address consistency check
- ✅ Chrome MV3 extension (scraper + service-worker + offscreen + popup)
- ✅ React dashboard with 4 scenarios, Scraper Health widget, AI-match button, animations, dark teal theme
- ✅ Documentation (extension README)
- ✅ **Good-citizen layer (2026-02 patch)**: robots.txt parser + 12h cache + alarm-driven refresh; every cross-site fetch and scrape upload gated by `isUrlAllowed()`; wildcards & `$` anchors supported (7/7 unit tests passing)
- ✅ **Trademark guardrail**: nominative-fair-use disclaimer in popup footer ("not affiliated with…")

## Backlog / Next
- P1: Live extension testing on real DoorDash/UberEats/Grubhub pages (selectors will drift)
- P1: Auto-coupon/promo-code awareness in landed-cost calculation (factor active codes)
- P2: User auth + saved comparison history
- P2: Push notifications when winner changes
- P3: Mobile companion / iOS Safari extension
