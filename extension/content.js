// DunaSavvy — content.js
// Multi-site scraper for DoorDash, Uber Eats, Grubhub.
// Best-effort selectors with graceful fallback. Sends scraped cart snapshots
// to the background service worker, which forwards them to the FastAPI engine.

(function () {
  const HOST = location.hostname;
  const platform = HOST.includes("doordash")
    ? "doordash"
    : HOST.includes("ubereats")
    ? "ubereats"
    : HOST.includes("grubhub")
    ? "grubhub"
    : null;
  if (!platform) return;

  const SCRAPE_INTERVAL_MS = 4000;
  let lastSerialized = "";

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function parsePrice(text) {
    if (!text) return 0;
    const m = String(text).replace(/[, ]/g, "").match(/-?\$?(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  // Selector strategies per platform — these change frequently.
  const STRATEGIES = {
    doordash: {
      restaurant: ['[data-anchor-id="StoreHeader"] h1', "h1[data-testid='store-name']", "h1"],
      address: ['[data-testid="addressTextButton"]', '[data-anchor-id="address-pill"]', "header a[href*='address']"],
      items: ['[data-testid="cart-item-row"]', "[data-anchor-id='CartItem']"],
      itemName: ["span[data-testid='cart-item-name']", "h3", "span"],
      itemPrice: ["[data-testid='cart-item-price']", "span"],
      subtotal: ["[data-testid='subtotal']", "[data-anchor-id='OrderCartSubtotal']"],
      serviceFee: ["[data-testid='service-fee']", "[data-anchor-id='ServiceFee']"],
      deliveryFee: ["[data-testid='delivery-fee']", "[data-anchor-id='DeliveryFee']"],
      tax: ["[data-testid='tax']", "[data-anchor-id='Tax']"],
      eta: ["[data-testid='delivery-time']", "[data-anchor-id='delivery-time']"],
    },
    ubereats: {
      restaurant: ["h1[data-testid='store-title']", "h1"],
      address: ["[data-testid='deliver-to-address']", "header [aria-label*='Address']"],
      items: ["[data-testid='cart-item']", "li[data-test='cart-item']"],
      itemName: ["[data-testid='cart-item-name']", "div[data-test='item-name']"],
      itemPrice: ["[data-testid='cart-item-price']", "div[data-test='item-price']"],
      subtotal: ["[data-testid='cart-subtotal']"],
      serviceFee: ["[data-testid='cart-service-fee']"],
      deliveryFee: ["[data-testid='cart-delivery-fee']"],
      tax: ["[data-testid='cart-tax']"],
      eta: ["[data-testid='estimated-delivery-time']"],
    },
    grubhub: {
      restaurant: ["h1.restaurantName", "h1"],
      address: ["#searchAddress input", "[data-testid='delivery-address']"],
      items: ["[data-testid='cart-item']", "li.cartItem-info"],
      itemName: ["[data-testid='cart-item-name']", ".cartItem-name"],
      itemPrice: ["[data-testid='cart-item-price']", ".cartItem-price"],
      subtotal: ["[data-testid='subtotal']", ".cartTotals-subtotal"],
      serviceFee: ["[data-testid='service-fee']", ".cartTotals-service"],
      deliveryFee: ["[data-testid='delivery-fee']", ".cartTotals-delivery"],
      tax: ["[data-testid='tax']", ".cartTotals-tax"],
      eta: ["[data-testid='delivery-eta']"],
    },
  };

  function trySelectors(list) {
    for (const sel of list) {
      const el = $(sel);
      if (el && el.textContent.trim()) return el;
    }
    return null;
  }

  function trySelectorsAll(list) {
    for (const sel of list) {
      const els = $$(sel);
      if (els.length) return els;
    }
    return [];
  }

  function scrape() {
    const s = STRATEGIES[platform];
    const restaurantEl = trySelectors(s.restaurant);
    const addressEl = trySelectors(s.address);
    const itemEls = trySelectorsAll(s.items);

    const items = itemEls.map((row) => {
      const nameEl = trySelectors(s.itemName.map((sel) => sel)) || row.querySelector("h3, span, div");
      const priceEl = trySelectors(s.itemPrice.map((sel) => sel)) || row;
      const name = (nameEl?.textContent || row.textContent || "").trim().slice(0, 120);
      const price = parsePrice(priceEl?.textContent || "");
      return { name, price, quantity: 1, options: "" };
    }).filter((it) => it.name && it.price > 0);

    if (!restaurantEl && !items.length) return null;

    const subtotal = parsePrice(trySelectors(s.subtotal)?.textContent);
    const cart = {
      platform,
      restaurant: (restaurantEl?.textContent || "").trim().slice(0, 120),
      address: (addressEl?.textContent || addressEl?.value || "").trim().slice(0, 200),
      items,
      subtotal: subtotal || items.reduce((a, b) => a + b.price * b.quantity, 0),
      service_fee: parsePrice(trySelectors(s.serviceFee)?.textContent),
      delivery_fee: parsePrice(trySelectors(s.deliveryFee)?.textContent),
      tax: parsePrice(trySelectors(s.tax)?.textContent),
      eta_minutes: parseInt((trySelectors(s.eta)?.textContent || "").replace(/\D+/g, ""), 10) || null,
      available: items.length > 0,
      auth_required: false,
    };
    return cart;
  }

  function tick() {
    try {
      const cart = scrape();
      if (!cart) return;
      const ser = JSON.stringify(cart);
      if (ser === lastSerialized) return;
      lastSerialized = ser;
      chrome.runtime.sendMessage({ type: "SCRAPED_CART", cart }, () => void chrome.runtime.lastError);
    } catch (e) {
      // swallow — we never want to break the host site
    }
  }

  setInterval(tick, SCRAPE_INTERVAL_MS);
  setTimeout(tick, 1500);
})();
