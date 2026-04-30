// DunaSavvy Popup — "Food, Smarter" cobalt UI logic
// Talks to background.js (price engine) and falls back to /api/search when no scraped cart exists.

import { PLATFORMS, getAPI } from "../config.js";

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  query: $("#query"),
  submit: $("#submit"),
  submitText: $("#submit-text"),
  shell: $("#search-shell"),
  suggestions: $("#suggestions"),
  results: $("#results"),
  banner: $("#banner"),
  winnerStrip: $("#winner-strip"),
  reset: $("#reset"),
  tabs: $$(".tab"),
};

let mode = "address";
let activeAddress = "";
let suggestions = [];
let activeIdx = -1;
let suggestionTimer = null;
let scanning = false;

// ---------- Helpers ----------
const fmt$ = (n) => `$${(Number(n) || 0).toFixed(2)}`;

function setMode(next) {
  mode = next;
  els.tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.mode === mode));
  if (mode === "address") {
    els.query.placeholder = "Enter your delivery address";
    els.query.value = activeAddress || "";
  } else {
    els.query.placeholder = activeAddress ? "Search for a restaurant…" : "Search restaurant (we'll need an address too)";
    els.query.value = "";
  }
  hideSuggestions();
  els.query.focus();
}

function hideSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = "";
  activeIdx = -1;
}

function renderSuggestions() {
  if (!suggestions.length) return hideSuggestions();
  els.suggestions.hidden = false;
  els.suggestions.innerHTML = suggestions.map((s, i) => `
    <li class="${i === activeIdx ? "is-active" : ""}" data-idx="${i}">
      <svg class="s-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <div>
        <div class="s-main">${s.short || s.label}</div>
        <div class="s-sub">${s.label}</div>
      </div>
    </li>
  `).join("");
  els.suggestions.querySelectorAll("li").forEach((li) => {
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      pickSuggestion(Number(li.dataset.idx));
    });
  });
}

async function fetchSuggestions(q) {
  if (!q || q.length < 3 || mode !== "address") {
    suggestions = []; renderSuggestions(); return;
  }
  try {
    // Nominatim (OpenStreetMap) — free, no key. Respect their UA + rate-limit policy.
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&addressdetails=1`, {
      headers: { "Accept-Language": "en" },
    });
    const data = await res.json();
    suggestions = (data || []).map((f) => {
      const a = f.address || {};
      const short = [a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road, a.city || a.town || a.village, a.state].filter(Boolean).join(", ");
      return {
        label: f.display_name,
        short: short || f.display_name.split(",").slice(0, 2).join(","),
        coords: [parseFloat(f.lon), parseFloat(f.lat)],
      };
    });
    activeIdx = suggestions.length ? 0 : -1;
    renderSuggestions();
  } catch {
    suggestions = []; renderSuggestions();
  }
}

function pickSuggestion(i) {
  const s = suggestions[i]; if (!s) return;
  activeAddress = s.label;
  els.query.value = s.label;
  hideSuggestions();
  runSearch({ address: s.label, lat: s.coords?.[1], lon: s.coords?.[0] });
}

function showBanner(kind, title, sub) {
  els.banner.hidden = false;
  els.banner.className = `banner is-${kind}`;
  els.banner.querySelector(".banner-title").textContent = title;
  els.banner.querySelector(".banner-sub").textContent = sub || "";
}
function hideBanner() { els.banner.hidden = true; }

function setScanning(on) {
  scanning = on;
  els.shell.classList.toggle("is-scanning", on);
  els.submit.disabled = on;
  els.submitText.textContent = on ? "Scanning…" : "Find Food";
}

// ---------- Render results ----------
function platformBadge(platform) {
  const meta = PLATFORMS[platform];
  return `<span class="pcard-head" style="color:${meta.color}">${meta.label}</span>`;
}

function renderResults(data) {
  if (!data || data.error) {
    els.results.innerHTML = `<div class="empty"><div class="empty-circle"></div><div class="empty-title">${data?.error || "No results"}</div><div class="empty-sub">Try a different address or open a delivery site to add items.</div></div>`;
    hideBanner(); els.winnerStrip.hidden = true;
    return;
  }

  // Address banner
  if (data.address_consistent) {
    showBanner("ok", "Address synced across platforms", Object.values(data.addresses || {})[0] || "");
  } else {
    showBanner("warn", "Address mismatch", "Different zones across platforms — fees may not be comparable.");
  }

  // Winner strip
  const winner = data.winner_platform;
  const winnerCol = data.columns?.find((c) => c.platform === winner);
  const others = data.columns?.filter((c) => c.platform !== winner && c.available) || [];
  const cheapestOther = others.length ? Math.min(...others.map((c) => c.total_landed)) : null;
  const savings = winnerCol && cheapestOther != null ? cheapestOther - winnerCol.total_landed : 0;
  if (winner && savings > 0) {
    els.winnerStrip.hidden = false;
    els.winnerStrip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 6 13.5 14.5 8.5 9.5 2 16"/><polyline points="16 6 22 6 22 12"/></svg>
      <span>Winner: <span class="ws-platform">${PLATFORMS[winner].label}</span></span>
      <span class="ws-amount">save ${fmt$(savings)}</span>
    `;
  } else {
    els.winnerStrip.hidden = true;
  }

  const order = ["doordash", "ubereats", "grubhub"];
  const colsByPlat = Object.fromEntries((data.columns || []).map((c) => [c.platform, c]));

  els.results.innerHTML = order.map((plat) => {
    const c = colsByPlat[plat];
    if (!c) return "";
    const isWinner = c.platform === winner;
    const cls = ["pcard", isWinner ? "is-winner" : "", !c.available ? "is-unavailable" : ""].filter(Boolean).join(" ");

    const flagTag = c.member_pass
      ? `<span class="tag tag-member">★ ${c.member_pass}</span>`
      : isWinner
      ? `<span class="tag tag-best">▼ Best total</span>`
      : c.auth_required
      ? `<span class="tag tag-auth">⏻ Sign in</span>`
      : "";

    const promoPill = c.promotion && c.promotion.discount > 0
      ? `<span class="pill is-promo">★ ${escapeHtml(c.promotion.label)} <span class="v">−${fmt$(c.promotion.discount)}</span></span>` : "";
    const freePill = c.member_free_delivery
      ? `<span class="pill is-free">Free delivery</span>` : "";
    const smallPill = c.small_order_fee > 0
      ? `<span class="pill is-small">Small-order +<span class="v">${fmt$(c.small_order_fee)}</span></span>` : "";

    return `
      <div class="${cls}" data-platform="${plat}">
        <div class="pcard-flag">${flagTag}</div>
        ${platformBadge(plat)}
        <div class="pcard-total">
          <div class="label">Total landed</div>
          <div class="amount">${fmt$(c.total_landed)}</div>
        </div>
        <div class="pcard-restaurant">${escapeHtml(c.restaurant || "—")}</div>
        <div class="pcard-meta">
          <span>⏱ ${c.eta_minutes ? c.eta_minutes + " min" : "—"}</span>
          <span class="dot"></span>
          <span>${c.items?.length || 0} items</span>
          <span class="dot"></span>
          <span class="mono">sub ${fmt$(c.subtotal)} · srv ${fmt$(c.service_fee)} · del ${fmt$(c.delivery_fee)} · tax ${fmt$(c.tax)}</span>
        </div>
        ${(promoPill || freePill || smallPill) ? `<div class="pcard-breakdown">${promoPill}${freePill}${smallPill}</div>` : ""}
      </div>
    `;
  }).join("");
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// ---------- Search ----------
async function runSearch(payload) {
  setScanning(true);
  hideBanner(); els.winnerStrip.hidden = true;
  els.results.innerHTML = `<div class="empty"><div class="empty-circle"></div><div class="empty-title">Scanning DoorDash · Uber Eats · Grubhub…</div><div class="empty-sub">Computing landed cost across platforms.</div></div>`;
  try {
    const API = await getAPI();
    const res = await fetch(`${API}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setTimeout(() => { renderResults(data); setScanning(false); }, 900);
  } catch (e) {
    setScanning(false);
    renderResults({ error: "Engine unreachable: " + e.message + ". Set chrome.storage.local.duna_backend_url if your backend moved." });
  }
}

async function tryRunComparisonFromScrapedCart() {
  // If user has scraped a real cart already, prefer it over demo search
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "RUN_COMPARE" }, (res) => {
      if (res && !res.error) resolve(res);
      else resolve(null);
    });
  });
}

// ---------- Submit logic ----------
function submit() {
  if (mode === "address") {
    const q = els.query.value.trim();
    if (!q) return;
    const sel = suggestions[Math.max(0, activeIdx)];
    activeAddress = sel?.label || q;
    runSearch({ address: activeAddress, lat: sel?.coords?.[1], lon: sel?.coords?.[0] });
  } else {
    const r = els.query.value.trim();
    if (!r) return;
    if (!activeAddress) {
      showBanner("warn", "Location required", "Delivery fees change block-by-block. Pop in your address first.");
      setMode("address");
      return;
    }
    runSearch({ address: activeAddress, restaurant: r });
  }
}

// ---------- Wire-up ----------
els.tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
els.query.addEventListener("input", (e) => {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => fetchSuggestions(e.target.value.trim()), 280);
});
els.query.addEventListener("keydown", (e) => {
  if (mode === "address" && suggestions.length) {
    if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, suggestions.length - 1); renderSuggestions(); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, -1); renderSuggestions(); return; }
    if (e.key === "Escape")    { hideSuggestions(); return; }
  }
  if (e.key === "Enter") { e.preventDefault(); submit(); }
});
els.submit.addEventListener("click", submit);
els.reset.addEventListener("click", async () => {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      await new Promise((r) => chrome.runtime.sendMessage({ type: "RESET_CART" }, r));
    }
  } catch {}
  els.query.value = "";
  activeAddress = "";
  hideBanner();
  els.winnerStrip.hidden = true;
  els.results.innerHTML = `<div class="empty"><div class="empty-circle">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3D5AFE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
  </div><div class="empty-title">Enter an address to begin</div><div class="empty-sub">Or open a delivery site and add items — DunaSavvy will scrape the cart automatically.</div></div>`;
  els.query.focus();
});

// ---------- Bootstrap ----------
(async function init() {
  // If the user has scraped a real cart already, render it directly
  const scraped = await tryRunComparisonFromScrapedCart();
  if (scraped) {
    activeAddress = Object.values(scraped.addresses || {}).find(Boolean) || "";
    if (activeAddress) els.query.value = activeAddress;
    renderResults(scraped);
  } else {
    els.query.focus();
  }
})();
query.value = activeAddress;
    renderResults(scraped);
  } else {
    els.query.focus();
  }
})();
