# DunaSavvy — Chrome Extension (Manifest V3)

Real-time price-comparison engine across **DoorDash**, **Uber Eats**, and **Grubhub**.

## What it does
1. **Scrapes** your active cart on the delivery site you're on (the *anchor*).
2. **Forwards** items + fees to the DunaSavvy FastAPI backend (the *brain*).
3. The backend uses **Claude Sonnet 4.5** to fuzzy-match items across platforms and computes the **Total Landed Cost** (Subtotal + Service Fee + Delivery Fee + Tax).
4. Detects **price-gouging** (any platform charging >10% over the median base price).
5. Renders a clean **three-column comparison** in the popup with the winner highlighted in green.

## Install (developer mode)
1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `/app/extension` folder
5. Pin DunaSavvy to your toolbar

## Configuration
Edit `config.js` — set `BACKEND_URL` to your FastAPI server (the default points to the live preview).

## Files
| File | Role |
|---|---|
| `manifest.json` | MV3 declaration |
| `background.js` | Service worker — router, virtual-cart state, backend bridge |
| `content.js` | Multi-site scraper with selector fallbacks |
| `offscreen.html/js` | Offscreen document for cross-site fetches |
| `popup/popup.html/js/css` | Three-column comparison UI |
| `config.js` | Backend URL + platform metadata |

## Notes
- Selectors for DoorDash/Uber Eats/Grubhub change frequently. The scraper is **best-effort** with multiple fallback strategies.
- The backend gracefully degrades — if the LLM is unreachable, a token-overlap fallback handles fuzzy matching.
- For the popup demo (when no cart has been scraped yet), it pulls `/api/demo-comparison`.

## Good-citizen behavior
- **Robots.txt aware**: `background.js` fetches & caches each platform's `/robots.txt` every 12 hours and gates every cross-site fetch + scrape upload through `isUrlAllowed()`. Send `{type:"ROBOTS_REFRESH"}` to force a refresh.
- **Rate-limit aware**: `FETCH_DELAY_MS` (1500ms) + 0–800ms jitter between any cross-platform request.
- **No login bypass**: when a competitor site has no session cookie, the popup surfaces an "Auth" tag and prompts the user to open the platform — we never forge or replay credentials.
- **Trademark guardrail**: Popup footer carries the standard "not affiliated with…" nominative-fair-use disclaimer.
