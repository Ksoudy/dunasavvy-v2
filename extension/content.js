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
      smallOrderFee: ["[data-testid='small-order-fee']", "[data-anchor-id='SmallOrderFee']", "[data-anchor-id='ExpandedSubtotalSmallOrderFee']"],
      tax: ["[data-testid='tax']", "[data-anchor-id='Tax']"],
      eta: ["[data-testid='delivery-time']", "[data-anchor-id='delivery-time']"],
      memberBadge: ["[data-anchor-id='DashPassEligibleBanner']", "[data-anchor-id='DashPassBadge']", "[data-testid='dashpass-banner']"],
      memberName: "DashPass",
      promo: ["[data-anchor-id='Promotion']", "[data-testid='promotion-banner']", "[data-anchor-id='PromoCallout']"],
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
      smallOrderFee: ["[data-testid='cart-small-order-fee']", "[data-test='small-order-fee']"],
      tax: ["[data-testid='cart-tax']"],
      eta: ["[data-testid='estimated-delivery-time']"],
      memberBadge: ["[data-testid='uber-one-banner']", "[data-test='uber-one']", "[aria-label*='Uber One']"],
      memberName: "Uber One",
      promo: ["[data-testid='cart-promotion']", "[data-test='promo-banner']", "[data-testid='promotion-banner']"],
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
      smallOrderFee: ["[data-testid='small-order-fee']", ".cartTotals-smallOrder"],
      tax: ["[data-testid='tax']", ".cartTotals-tax"],
      eta: ["[data-testid='delivery-eta']"],
      memberBadge: ["[data-testid='grubhub-plus-banner']", ".grubhubPlus-badge"],
      memberName: "Grubhub+",
      promo: ["[data-testid='promo-banner']", ".cartPromo"],
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

  function parsePromoText(text) {
    if (!text) return null;
    const t = text.trim();
    if (!t || t.length > 140) return null;
    // Try $X off $Y first (most common: "$5 off $20", "Save $7 on orders over $30")
    const dollarOff = t.match(/\$\s?(\d+(?:\.\d+)?)\s*(?:off|save|discount)/i);
    if (dollarOff) return { label: t.slice(0, 60), discount: parseFloat(dollarOff[1]) };
    // Percent off ("20% off")
    const pctOff = t.match(/(\d+(?:\.\d+)?)\s*%\s*off/i);
    if (pctOff) return { label: t.slice(0, 60), discount: 0.0, pct: parseFloat(pctOff[1]) };
    // Buy 1 Get 1 — discount unknown without item context
    if (/\bbogo\b|\bbuy\s*1\s*get\s*1\b|free\s+item/i.test(t)) {
      return { label: t.slice(0, 60), discount: 0.0 };
    }
    return null;
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
    const deliveryFee = parsePrice(trySelectors(s.deliveryFee)?.textContent);
    const memberEl = trySelectors(s.memberBadge);
    const memberPass = memberEl ? s.memberName : null;
    const memberFreeDelivery = !!(memberPass && deliveryFee === 0);
    const promoEl = trySelectors(s.promo);
    const promotion = promoEl ? parsePromoText(promoEl.textContent) : null;

    const cart = {
      platform,
      restaurant: (restaurantEl?.textContent || "").trim().slice(0, 120),
      address: (addressEl?.textContent || addressEl?.value || "").trim().slice(0, 200),
      items,
      subtotal: subtotal || items.reduce((a, b) => a + b.price * b.quantity, 0),
      service_fee: parsePrice(trySelectors(s.serviceFee)?.textContent),
      delivery_fee: deliveryFee,
      small_order_fee: parsePrice(trySelectors(s.smallOrderFee)?.textContent),
      tax: parsePrice(trySelectors(s.tax)?.textContent),
      eta_minutes: parseInt((trySelectors(s.eta)?.textContent || "").replace(/\D+/g, ""), 10) || null,
      available: items.length > 0,
      auth_required: false,
      member_pass: memberPass,
      member_free_delivery: memberFreeDelivery,
      promotion,
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
