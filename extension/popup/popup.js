import { PLATFORMS, API } from "../config.js";

const grid = document.getElementById("grid");
const banner = document.getElementById("address-banner");
const winnerStrip = document.getElementById("winner-strip");

function fmt$(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

function renderEmpty(msg) {
  grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">No virtual cart yet</div>${msg}</div>`;
  banner.hidden = true;
  winnerStrip.hidden = true;
}

function renderComparison(data) {
  if (!data || data.error) return renderEmpty(data?.error || "Open a delivery site and add items.");

  // Address banner
  if (!data.address_consistent) {
    const addrs = Object.entries(data.addresses).map(([k, v]) => `${PLATFORMS[k]?.label || k}: ${v || "—"}`).join(" • ");
    banner.className = "banner banner-warn";
    banner.querySelector(".banner-title").textContent = "Address mismatch detected";
    banner.querySelector(".banner-sub").textContent = addrs;
    banner.hidden = false;
  } else {
    banner.className = "banner banner-ok";
    banner.querySelector(".banner-title").textContent = "Address synced across platforms";
    banner.querySelector(".banner-sub").textContent = Object.values(data.addresses)[0] || "";
    banner.hidden = false;
  }

  const order = ["doordash", "ubereats", "grubhub"];
  const colsByPlat = Object.fromEntries(data.columns.map((c) => [c.platform, c]));
  const gougeNames = new Set(data.gouging_flags.map((g) => `${g.platform}::${g.item}`));

  grid.innerHTML = order.map((plat) => {
    const c = colsByPlat[plat];
    if (!c) return `<div class="col unavailable"><div class="col-head"><span class="platform-name">${PLATFORMS[plat].label}</span></div><div class="empty">No data</div></div>`;
    const isWinner = data.winner_platform === plat;
    const cls = `col ${isWinner ? "winner" : ""} ${!c.available ? "unavailable" : ""}`;
    const itemsHtml = c.items.map((it) => {
      const isG = gougeNames.has(`${plat}::${it.name}`);
      return `<div class="item ${isG ? "gouge" : ""}"><span class="nm" title="${it.name}">${it.name}</span><span class="pr">${fmt$(it.price)}</span></div>`;
    }).join("") || `<div class="item"><span class="nm">${c.auth_required ? "Sign in required to fetch cart" : "Empty cart"}</span></div>`;

    return `
      <div class="${cls}">
        ${isWinner ? '<span class="tag tag-winner">Best</span>' : ''}
        ${c.auth_required ? '<span class="tag tag-auth">Auth</span>' : ''}
        <div class="col-head"><span class="platform-name" style="color:${PLATFORMS[plat].color}">${PLATFORMS[plat].label}</span><span class="platform-eta">${c.eta_minutes ? c.eta_minutes + " min" : "—"}</span></div>
        <div class="items">${itemsHtml}</div>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${fmt$(c.subtotal)}</span></div>
          <div class="row"><span>Service</span><span>${fmt$(c.service_fee)}</span></div>
          <div class="row"><span>Delivery</span><span>${fmt$(c.delivery_fee)}</span></div>
          <div class="row"><span>Tax</span><span>${fmt$(c.tax)}</span></div>
        </div>
        <div class="landed">${fmt$(c.total_landed)}</div>
      </div>`;
  }).join("");

  if (data.winner_platform) {
    const w = colsByPlat[data.winner_platform];
    const others = data.columns.filter((c) => c.platform !== data.winner_platform && c.available);
    const cheapestOther = others.length ? Math.min(...others.map((c) => c.total_landed)) : null;
    const savings = cheapestOther ? (cheapestOther - w.total_landed) : 0;
    winnerStrip.innerHTML = `Winner: <strong>${PLATFORMS[data.winner_platform].label}</strong> at ${fmt$(w.total_landed)}${savings > 0 ? ` — saves ${fmt$(savings)} vs next best` : ""}`;
    winnerStrip.hidden = false;
  } else {
    winnerStrip.hidden = true;
  }
}

async function compareNow() {
  grid.innerHTML = `<div class="empty" style="grid-column:1/-1">Computing landed cost…</div>`;
  const res = await chrome.runtime.sendMessage({ type: "RUN_COMPARE" });
  if (res?.error) {
    // Fallback to demo when no scraped cart
    try {
      const demo = await fetch(`${API}/demo-comparison`).then((r) => r.json());
      renderComparison(demo);
      banner.querySelector(".banner-title").textContent = "Demo mode";
      banner.querySelector(".banner-sub").textContent = "Add items on a real delivery site to switch to live mode.";
    } catch {
      renderEmpty(res.error);
    }
  } else {
    renderComparison(res);
  }
}

document.getElementById("refresh").addEventListener("click", compareNow);
document.getElementById("reset").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "RESET_CART" });
  renderEmpty("Cart cleared. Add items on a delivery site.");
});

compareNow();
