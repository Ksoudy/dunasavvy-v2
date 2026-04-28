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
- ✅ Backend with all 7 endpoints + Mongo persistence
- ✅ AI fuzzy matching via Emergent LLM key (Claude Sonnet 4.5) with graceful fallback
- ✅ Gouging detection (median + 10% threshold)
- ✅ Total landed cost calculation
- ✅ Address consistency check
- ✅ Chrome MV3 extension (scraper + service-worker + offscreen + popup)
- ✅ React dashboard with 4 scenarios, animations, dark teal theme
- ✅ Documentation (extension README)

## Backlog / Next
- P1: Live extension testing on real DoorDash/UberEats/Grubhub pages (selectors will drift)
- P1: Persistent restaurant slug normalization across platforms
- P2: User auth + saved comparison history
- P2: Push notifications when winner changes
- P3: Mobile companion / iOS Safari extension
