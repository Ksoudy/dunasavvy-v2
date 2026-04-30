import { useEffect, useMemo, useRef, useState } from "react";
import "@/App.css";
import axios from "axios";
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Check, ChevronRight,
  Copy, Download, Eye, Flame, Github, MapPin, Navigation, Radar, RefreshCw,
  Search, ShieldCheck, Sparkles, Store, Timer, TrendingDown, Truck, Wifi, X, Zap,
} from "lucide-react";

const RAW_BACKEND = process.env.REACT_APP_BACKEND_URL;
// Defensive: if the build was published without REACT_APP_BACKEND_URL set
// (e.g. GH Pages without the BACKEND_URL secret) we fall back to same-origin
// "/api" — which gives a useful 404 instead of "undefined/api/...".
const API = `${RAW_BACKEND || ""}/api`;
const BACKEND_MISSING = !RAW_BACKEND;

const PLATFORMS = {
  doordash: { label: "DoorDash", short: "DD", color: "#ef2a44" },
  ubereats: { label: "Uber Eats", short: "UE", color: "#06c167" },
  grubhub:  { label: "Grubhub",  short: "GH", color: "#f63440" },
};

const fmt$ = (n) => `$${(Number(n) || 0).toFixed(2)}`;

function Pill({ children, tone = "teal", className = "" }) {
  const tones = {
    teal:   "bg-[rgba(13,148,136,.10)] text-[var(--teal-700)] border-[#a8d8d1]",
    amber:  "bg-[rgba(217,119,6,.10)] text-[#92400e] border-[#fbbf24]",
    green:  "bg-[rgba(22,163,74,.10)]  text-[#15803d] border-[#86efac]",
    muted:  "bg-[rgba(13,148,136,.04)] text-[var(--muted)] border-[var(--border)]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium tracking-wide ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

function Header({ onScenario, scenario, onRefresh, loading }) {
  return (
    <header data-testid="app-header" className="sticky top-0 z-30 backdrop-blur-md bg-[rgba(255,255,255,.7)] border-b border-[var(--border)]">
      <div className="max-w-[1320px] mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--cobalt)] to-[var(--cobalt-dark)] flex items-center justify-center shadow-[0_8px_24px_var(--cobalt-glow)]">
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-lg leading-none">DunaSavvy</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mt-1">Delivery price engine</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-[var(--muted)]">
          <a href="#engine" className="hover:text-[var(--text)] transition-colors">Engine</a>
          <a href="#health" className="hover:text-[var(--text)] transition-colors">Health</a>
          <a href="#cart" className="hover:text-[var(--text)] transition-colors">Virtual cart</a>
          <a href="#install" className="hover:text-[var(--text)] transition-colors">Install</a>
        </nav>
        <div className="flex items-center gap-2">
          <select
            data-testid="scenario-select"
            value={scenario}
            onChange={(e) => onScenario(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] text-sm px-3 py-2 rounded-lg outline-none focus:border-[var(--teal-500)]"
          >
            <option value="default">Default scenario</option>
            <option value="membership">Membership + promo</option>
            <option value="gouging">Gouging detected</option>
            <option value="address_mismatch">Address mismatch</option>
            <option value="auth_required">Auth required</option>
          </select>
          <button
            data-testid="refresh-btn"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--cobalt)] hover:bg-[var(--cobalt-dark)] text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-[0_4px_14px_var(--cobalt-glow)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Re-run
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onScrollToEngine, onSearch, location, scanning, extensionId }) {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-[920px] mx-auto px-8 pt-16 pb-12 text-center fade-up">
        <Pill tone="cobalt" className="mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--cobalt)] animate-pulse" />
          Live engine · Claude Sonnet 4.5
        </Pill>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.025em] leading-[1.02]">
          Where do you want<br />
          <span className="text-[var(--cobalt)]">food, smarter?</span>
        </h1>
        <p className="mt-5 text-base text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          Type your delivery address or a restaurant. DunaSavvy scans <strong className="text-[var(--text)]">DoorDash</strong>, <strong className="text-[var(--text)]">Uber Eats</strong>, and <strong className="text-[var(--text)]">Grubhub</strong> for the cheapest total landed cost — fees, delivery, and tax included.
        </p>

        <div className="mt-8 max-w-3xl mx-auto text-left">
          <SearchHero onSearch={onSearch} location={location} scanning={scanning} />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[var(--green)]" /> Public data only · no logins required</span>
          <span className="inline-flex items-center gap-1.5"><Radar className="w-3.5 h-3.5 text-[var(--cobalt)]" /> Nominatim geocoding</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[var(--cobalt)]" /> AI item-matching</span>
          {extensionId && (
            <span data-testid="extension-detected" className="inline-flex items-center gap-1.5 text-[var(--cobalt)] font-semibold">
              <Check className="w-3.5 h-3.5" /> Extension active
            </span>
          )}
        </div>

        <div className="mt-12 grid grid-cols-3 max-w-md mx-auto gap-6">
          {[
            { k: "<2s", v: "Cross-platform compare" },
            { k: "10%+", v: "Gouging threshold" },
            { k: "MV3", v: "Manifest version" },
          ].map((s) => (
            <div key={s.v}>
              <div className="mono text-2xl text-[var(--text)] font-bold tabular">{s.k}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-2)] mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="tick-bar max-w-[1320px] mx-auto" />
    </section>
  );
}

function SearchHero({ onSearch, location, scanning }) {
  const [mode, setMode] = useState("address"); // 'address' | 'restaurant'
  const [query, setQuery] = useState(location?.address || "");
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [showLocationToast, setShowLocationToast] = useState(false);
  const debouncerRef = useRef();

  const fetchSuggestions = async (q) => {
    if (!q || q.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&addressdetails=1`, {
        headers: { "Accept-Language": "en" },
      });
      const data = await res.json();
      const items = (data || []).map((f) => {
        const a = f.address || {};
        const short = [a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road, a.city || a.town || a.village, a.state].filter(Boolean).join(", ");
        return {
          label: f.display_name,
          short: short || f.display_name.split(",").slice(0, 2).join(","),
          coords: [parseFloat(f.lon), parseFloat(f.lat)], // [lon, lat]
        };
      });
      setSuggestions(items);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    if (mode !== "address") { setSuggestions([]); return; }
    clearTimeout(debouncerRef.current);
    debouncerRef.current = setTimeout(() => fetchSuggestions(query), 280);
    return () => clearTimeout(debouncerRef.current);
  }, [query, mode]);

  const submit = () => {
    if (mode === "address") {
      if (!query.trim()) return;
      const sel = suggestions[Math.max(0, activeSuggestion)] || { label: query, coords: null };
      onSearch?.({ address: sel.label, lat: sel.coords?.[1], lon: sel.coords?.[0] });
      setSuggestions([]);
    } else {
      if (!restaurantQuery.trim()) return;
      if (!query.trim()) {
        // Need an address first
        setShowLocationToast(true);
        setTimeout(() => setShowLocationToast(false), 4500);
        return;
      }
      onSearch?.({ address: query, restaurant: restaurantQuery });
    }
  };

  const onKeyDown = (e) => {
    if (mode !== "address") return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestion((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Escape") setSuggestions([]);
  };

  return (
    <div className="mt-7 relative">
      {/* Mode tabs */}
      <div className="inline-flex p-1 rounded-full bg-white border border-[var(--border)] mb-3">
        {[{k:"address",t:"Address",I:Navigation},{k:"restaurant",t:"Restaurant",I:Store}].map(({k,t,I}) => (
          <button
            key={k}
            data-testid={`mode-${k}`}
            onClick={() => setMode(k)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm rounded-full font-semibold transition-colors ${
              mode === k ? "bg-[var(--cobalt)] text-white shadow-[0_4px_14px_var(--cobalt-glow)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <I className="w-3.5 h-3.5" />{t}
          </button>
        ))}
      </div>

      <div className={`search-spring relative bg-white border-2 ${scanning ? "border-[var(--cobalt)]" : "border-[var(--border)]"} rounded-2xl p-2 shadow-[0_12px_40px_-16px_rgba(11,19,64,.18)]`}>
        {scanning && (
          <>
            <span className="scan-ring" />
            <span className="scan-ring" />
            <span className="scan-ring" />
          </>
        )}
        <div className="flex items-stretch gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0 px-4">
            {mode === "address" ? <Navigation className="w-5 h-5 text-[var(--cobalt)] shrink-0" /> : <MapPin className="w-5 h-5 text-[var(--cobalt)] shrink-0" />}
            <input
              data-testid="hero-address-input"
              type="text"
              placeholder={mode === "address" ? "Enter your delivery address (e.g. 120 W Madison St, Chicago)" : "Search for a restaurant…"}
              value={mode === "address" ? query : restaurantQuery}
              onChange={(e) => mode === "address" ? setQuery(e.target.value) : setRestaurantQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full bg-transparent outline-none border-0 py-3 text-base text-[var(--text)] placeholder:text-[var(--muted-2)]"
            />
            {mode === "restaurant" && query && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--cobalt-soft)] text-[var(--cobalt)] text-[11px] font-medium border border-[var(--cobalt)]/20 truncate max-w-[260px]">
                <MapPin className="w-3 h-3" /> {query}
              </span>
            )}
          </div>
          <button
            data-testid="find-food-btn"
            onClick={submit}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 rounded-xl bg-[var(--cobalt)] hover:bg-[var(--cobalt-dark)] text-white font-semibold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-[0_8px_24px_var(--cobalt-glow)] disabled:opacity-60"
          >
            {scanning ? <><Radar className="w-4 h-4 animate-spin" /> Scanning…</> : <><Search className="w-4 h-4" /> Find Food</>}
          </button>
        </div>

        {mode === "address" && suggestions.length > 0 && (
          <ul data-testid="address-suggestions" className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 bg-white border border-[var(--border)] rounded-2xl shadow-[0_24px_48px_-20px_rgba(11,19,64,.25)] overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={i}
                data-testid={`suggestion-${i}`}
                onMouseDown={(e) => { e.preventDefault(); setQuery(s.label); setActiveSuggestion(i); setSuggestions([]); onSearch?.({ address: s.label, lat: s.coords?.[1], lon: s.coords?.[0] }); }}
                onMouseEnter={() => setActiveSuggestion(i)}
                className={`px-4 py-3 cursor-pointer flex items-start gap-3 border-b border-[var(--border)] last:border-0 ${activeSuggestion === i ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"}`}
              >
                <MapPin className="w-4 h-4 mt-0.5 text-[var(--cobalt)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text)] font-medium truncate">{s.short}</div>
                  <div className="text-xs text-[var(--muted)] truncate">{s.label}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showLocationToast && (
        <div data-testid="location-toast" className="slide-in-right fixed top-24 right-6 z-40 max-w-sm bg-white border border-[var(--cobalt)] rounded-2xl shadow-[0_24px_60px_-20px_rgba(61,90,254,.30)] p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--cobalt)] flex items-center justify-center text-white shrink-0"><MapPin className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[var(--text)]">Location required</div>
            <div className="text-xs text-[var(--muted)] mt-1">Delivery fees change block-by-block. Pop in your address so the engine compares the same zone.</div>
            <button onClick={() => { setMode("address"); setShowLocationToast(false); }} className="mt-2 text-xs font-semibold text-[var(--cobalt)] hover:underline inline-flex items-center gap-1">
              Add address <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <button onClick={() => setShowLocationToast(false)} className="text-[var(--muted-2)] hover:text-[var(--text)]"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

function FeatureRow() {
  const items = [
    { icon: <Eye />,         title: "Context-aware scraping",    body: "Anchors to your active address & restaurant so the comparison is geographically identical." },
    { icon: <Sparkles />,    title: "AI fuzzy item matching",    body: "Claude Sonnet 4.5 maps 'Large Pepperoni' ↔ 'Pepperoni Pizza – Large' across every menu." },
    { icon: <Truck />,       title: "Total landed cost",          body: "Subtotal + service + delivery + tax. The real number — not the bait price." },
    { icon: <Flame />,       title: "Anti-gouging monitor",       body: "Flags any platform charging >10% over the median base price for the same dish." },
  ];
  return (
    <section className="max-w-[1320px] mx-auto px-8 py-16 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
      {items.map((f, i) => (
        <div key={i} className="group p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--teal-600)] transition-all hover:-translate-y-0.5 fade-up" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="w-10 h-10 rounded-lg bg-[rgba(20,184,166,.12)] flex items-center justify-center text-[var(--teal-300)] group-hover:bg-[rgba(20,184,166,.18)] transition-colors">
            {f.icon}
          </div>
          <div className="mt-4 font-bold text-base">{f.title}</div>
          <div className="text-sm text-[var(--muted)] mt-2 leading-relaxed">{f.body}</div>
        </div>
      ))}
    </section>
  );
}

function AddressBanner({ data }) {
  if (!data) return null;
  const ok = data.address_consistent;
  const addresses = Object.entries(data.addresses).filter(([, v]) => v);
  return (
    <div data-testid="address-banner" className={`mt-4 rounded-xl border px-4 py-3 flex items-start gap-3 ${ok ? "border-[var(--green)]/40 bg-[var(--green-soft)]" : "border-[var(--amber)]/50 bg-[var(--amber-soft)]"}`}>
      {ok ? <ShieldCheck className="w-5 h-5 text-[var(--green)] mt-0.5 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-[var(--amber)] mt-0.5 shrink-0" />}
      <div className="flex-1">
        <div className="text-sm font-semibold">{ok ? "Delivery address synced across all platforms" : "Address mismatch detected"}</div>
        <div className="text-xs text-[var(--muted)] mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {addresses.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              <span className="text-[var(--muted-2)]">{PLATFORMS[k]?.label}:</span>
              <span className="text-[var(--text)]">{v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColumnCard({ col, isWinner, gougingItems }) {
  const gougeSet = new Set(gougingItems.map((g) => g.item));
  return (
    <div
      data-testid={`column-${col.platform}`}
      className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
        isWinner ? "border-[var(--green)] winner-glow bg-[rgba(34,197,94,.04)]" :
        !col.available ? "border-[var(--border)] bg-[var(--surface)] opacity-60" :
        "border-[var(--border-2)] bg-[var(--surface)] hover:border-[var(--teal-600)]"
      }`}
    >
      {isWinner && (
        <div data-testid={`winner-tag-${col.platform}`} className="absolute -top-3 left-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--green)] text-[#04181a] text-[11px] font-bold uppercase tracking-wider">
          <TrendingDown className="w-3 h-3" /> Best total
        </div>
      )}
      {col.auth_required && (
        <div className="absolute -top-3 left-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--amber)] text-[#04181a] text-[11px] font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3" /> Sign in needed
        </div>
      )}
      {col.member_pass && !col.auth_required && (
        <div data-testid={`member-${col.platform}`} className="absolute -top-3 right-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--cobalt)] text-white text-[11px] font-bold uppercase tracking-wider shadow-[0_4px_14px_var(--cobalt-glow)]">
          <Sparkles className="w-3 h-3" /> {col.member_pass}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: PLATFORMS[col.platform].color }}>
            {PLATFORMS[col.platform].label}
          </div>
          <div className="text-sm font-semibold text-[var(--text)] mt-1 truncate max-w-[220px]">{col.restaurant || "—"}</div>
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <Timer className="w-3.5 h-3.5" /> {col.eta_minutes ? `${col.eta_minutes} min` : "—"}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 max-h-44 overflow-auto thin-scroll pr-1">
        {col.items.length ? col.items.map((it, i) => {
          const flagged = gougeSet.has(it.name);
          return (
            <div key={i} className="flex items-center justify-between text-sm gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {flagged && <AlertTriangle className="w-3.5 h-3.5 text-[var(--amber)] shrink-0" />}
                <span className="truncate text-[var(--muted)]" title={it.name}>{it.name}</span>
              </div>
              <span className="mono text-[var(--text)] tabular shrink-0">{fmt$(it.price)}</span>
            </div>
          );
        }) : (
          <div className="text-sm text-[var(--muted-2)] italic">{col.auth_required ? "Open the platform & sign in to fetch this cart." : "No items"}</div>
        )}
      </div>

      <div className="border-t border-dashed border-[var(--border)] pt-3 flex flex-col gap-1.5 text-xs text-[var(--muted)]">
        {col.promotion && col.promotion.discount > 0 && (
          <div className="flex justify-between" data-testid={`promo-${col.platform}`}>
            <span className="inline-flex items-center gap-1.5 text-[var(--green)]">
              <Sparkles className="w-3 h-3" /> {col.promotion.label}
            </span>
            <span className="mono tabular text-[var(--green)] font-semibold">−{fmt$(col.promotion.discount)}</span>
          </div>
        )}
        {[
          ["Subtotal", col.subtotal],
          ["Service fee", col.service_fee],
          ["Delivery", col.delivery_fee, col.member_free_delivery ? "Free · " + (col.member_pass || "Member") : null],
          ...(col.small_order_fee > 0 ? [["Small order fee", col.small_order_fee]] : []),
          ["Tax", col.tax],
        ].map(([k, v, badge]) => (
          <div key={k} className="flex justify-between">
            <span className="inline-flex items-center gap-2">
              {k}
              {badge && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--cobalt-soft)] text-[var(--cobalt)] text-[9px] font-bold uppercase tracking-wider border border-[var(--cobalt)]/20">
                  <Check className="w-2.5 h-2.5" />{badge}
                </span>
              )}
            </span>
            <span className={`mono tabular ${k === "Delivery" && col.member_free_delivery ? "text-[var(--green)] line-through" : "text-[var(--text)]"}`}>{fmt$(v)}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-end justify-between">
        <div className="text-[11px] uppercase tracking-widest text-[var(--muted-2)]">Total landed</div>
        <div className={`mono font-extrabold text-3xl tabular ${isWinner ? "text-[var(--green)]" : "text-[var(--text)]"}`}>
          {fmt$(col.total_landed)}
        </div>
      </div>
    </div>
  );
}

function EngineSection({ data, loading, error, location }) {
  const winner = data?.winner_platform;
  const order = ["doordash", "ubereats", "grubhub"];
  const cols = useMemo(() => {
    if (!data) return [];
    const m = Object.fromEntries(data.columns.map((c) => [c.platform, c]));
    return order.map((p) => m[p]).filter(Boolean);
  }, [data]);

  const gougeByPlat = useMemo(() => {
    const map = {};
    if (data) for (const g of data.gouging_flags) (map[g.platform] ||= []).push(g);
    return map;
  }, [data]);

  const winnerCol = data?.columns.find((c) => c.platform === winner);
  const others = data?.columns.filter((c) => c.platform !== winner && c.available) || [];
  const next = others.length ? Math.min(...others.map((c) => c.total_landed)) : null;
  const savings = winnerCol && next != null ? next - winnerCol.total_landed : 0;

  return (
    <section id="engine" className="max-w-[1320px] mx-auto px-8 pb-16">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <Pill tone="cobalt" className="mb-3"><Activity className="w-3 h-3" /> Live comparison</Pill>
          <h2 className="text-3xl font-extrabold tracking-tight">The Price Engine</h2>
          <p className="text-[var(--muted)] mt-2 max-w-xl text-sm">
            Three platforms scraped, AI-matched, and ranked by total landed cost. Re-run scenarios above to see gouging, auth and address-guard flows.
          </p>
          {location?.address && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[var(--cobalt)]/30 text-xs text-[var(--cobalt)] font-medium">
              <MapPin className="w-3 h-3" /> Zone locked to <span className="text-[var(--text)] truncate max-w-[260px]">{location.address}</span>
            </div>
          )}
        </div>
        {data && (
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="mono">{new Date(data.generated_at).toLocaleTimeString()}</span>
            <span>·</span>
            <span>session {data.session_id.slice(0, 8)}</span>
          </div>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {data && <AddressBanner data={data} />}

      <div className="mt-6 grid lg:grid-cols-3 gap-5">
        {loading && !cols.length && [0,1,2].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] h-[340px] animate-pulse" />
        ))}
        {cols.map((c) => (
          <ColumnCard key={c.platform} col={c} isWinner={c.platform === winner} gougingItems={gougeByPlat[c.platform] || []} />
        ))}
      </div>

      {data && winner && savings > 0 && (
        <div data-testid="winner-strip" className="mt-6 rounded-2xl border border-[var(--green)]/40 bg-gradient-to-r from-[var(--green-soft)] to-[rgba(13,148,136,.08)] p-5 flex flex-wrap items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--green)] text-[#04181a] flex items-center justify-center"><TrendingDown className="w-5 h-5" /></div>
          <div className="flex-1 min-w-[220px]">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Winner</div>
            <div className="text-lg font-bold">
              {PLATFORMS[winner].label} at <span className="mono text-[var(--green)]">{fmt$(winnerCol.total_landed)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">You save</div>
            <div className="mono text-2xl font-extrabold text-[var(--green)]">{fmt$(savings)}</div>
          </div>
        </div>
      )}

      {data?.gouging_flags?.length > 0 && (
        <div data-testid="gouging-section" className="mt-5 rounded-2xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-[var(--amber)]" />
            <div className="font-bold">Price gouging detected</div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.gouging_flags.map((g, i) => (
              <div key={i} className="rounded-lg border border-[var(--amber)]/30 bg-[rgba(0,0,0,.25)] p-3 text-sm">
                <div className="text-[10px] uppercase tracking-widest text-[var(--amber)] font-bold mb-1">{PLATFORMS[g.platform]?.label}</div>
                <div className="text-[var(--text)] truncate" title={g.item}>{g.item}</div>
                <div className="flex justify-between mt-2 text-xs text-[var(--muted)]">
                  <span>This: <span className="mono text-[var(--text)]">{fmt$(g.unit_price)}</span></span>
                  <span>Median: <span className="mono text-[var(--text)]">{fmt$(g.median_price)}</span></span>
                  <span className="mono text-[var(--amber)] font-bold">+{g.premium_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CartSection({ data }) {
  const [aiMatches, setAiMatches] = useState(null);
  const [matching, setMatching] = useState(false);
  const [usedLlm, setUsedLlm] = useState(false);

  const runAiMatch = async () => {
    setMatching(true);
    try {
      const r = await axios.get(`${API}/demo-fuzzy-match`);
      setAiMatches(r.data.matches || []);
      setUsedLlm(!!r.data.used_llm);
    } catch (e) {
      setAiMatches([]);
    } finally {
      setMatching(false);
    }
  };

  if (!data) return null;
  const allItems = data.columns.flatMap((c) =>
    c.items.map((it) => ({ ...it, platform: c.platform })),
  );
  const grouped = {};
  for (const it of allItems) {
    const key = it.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 22);
    (grouped[key] ||= []).push(it);
  }

  // Decide which dataset to render: AI matches if available else token bucket
  const rows = aiMatches
    ? aiMatches.map((m) => ({
        anchor: m.anchor,
        cells: {
          doordash: { name: m.anchor, price: data.columns.find((c) => c.platform === "doordash")?.items.find((it) => it.name === m.anchor)?.price },
          ubereats: m.ubereats,
          grubhub: m.grubhub,
        },
      }))
    : Object.values(grouped).map((g) => {
        const byP = Object.fromEntries(g.map((x) => [x.platform, x]));
        return { anchor: g[0].name, cells: byP };
      });

  return (
    <section id="cart" className="max-w-[1320px] mx-auto px-8 py-16">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <div>
          <Pill tone="muted" className="mb-3"><Sparkles className="w-3 h-3" /> AI-matched virtual cart</Pill>
          <h2 className="text-3xl font-extrabold tracking-tight mb-2">The Ghost Cart</h2>
          <p className="text-[var(--muted)] text-sm max-w-2xl">
            Each row is one logical item; columns show what each platform calls it and what they charge.
          </p>
        </div>
        <button
          data-testid="run-ai-match-btn"
          onClick={runAiMatch}
          disabled={matching}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
            aiMatches ? "bg-[var(--teal-700)] text-white" : "bg-gradient-to-r from-[var(--teal-500)] to-[var(--teal-600)] text-white hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(20,184,166,.30)]"
          } disabled:opacity-50`}
        >
          <Sparkles className={`w-4 h-4 text-white ${matching ? "animate-pulse" : ""}`} />
          {matching ? "AI matching…" : aiMatches ? "Re-run AI match" : "Run AI match"}
        </button>
      </div>

      {aiMatches && (
        <div data-testid="ai-match-status" className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--teal-600)]/40 bg-[rgba(13,148,136,.08)] text-xs text-[var(--teal-700)]">
          <Sparkles className="w-3 h-3 text-[var(--teal-600)]" />
          {usedLlm ? "Matched live by Claude Sonnet 4.5" : "Matched by token-overlap fallback"} · {aiMatches.length} items
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface)] overflow-hidden mt-4">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] border-b border-[var(--border)] px-5 py-3 font-bold">
          <div>Item</div><div>DoorDash</div><div>Uber Eats</div><div>Grubhub</div>
        </div>
        {rows.map((row, i) => {
          const prices = ["doordash", "ubereats", "grubhub"]
            .map((p) => row.cells[p]?.price)
            .filter((p) => typeof p === "number");
          const minP = prices.length ? Math.min(...prices) : null;
          return (
            <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] px-5 py-4 border-b border-[var(--border)]/50 last:border-0 items-center text-sm hover:bg-[var(--surface-2)] transition-colors fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="text-[var(--text)] truncate pr-4">{row.anchor.replace(/[-—–].*$/, "").trim() || row.anchor}</div>
              {["doordash", "ubereats", "grubhub"].map((p) => {
                const cell = row.cells[p];
                if (!cell || typeof cell.price !== "number") return <div key={p} className="text-[var(--muted-2)]">—</div>;
                const isMin = cell.price === minP;
                return (
                  <div key={p} className="flex flex-col">
                    <span className={`mono tabular font-semibold ${isMin ? "text-[var(--green)]" : "text-[var(--text)]"}`}>{fmt$(cell.price)}</span>
                    <span className="text-[10px] text-[var(--muted-2)] truncate" title={cell.name}>{cell.name}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NearbyResults({ data, loading, error, onPick }) {
  if (!data && !loading && !error) return null;
  const results = data?.results || [];
  return (
    <section id="nearby" className="max-w-[1320px] mx-auto px-8 pb-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <Pill tone="cobalt" className="mb-3"><MapPin className="w-3 h-3" /> Nearby restaurants</Pill>
          <h2 className="text-3xl font-extrabold tracking-tight">Around your zone</h2>
          <p className="text-[var(--muted)] mt-2 max-w-xl text-sm">
            {data ? `${data.count} spots within ${data.radius_mi} mi · sorted by distance, then cheapest delivery fee.` : "Computing…"}
          </p>
        </div>
        {data && (
          <div className="text-xs text-[var(--muted)] mono">
            {data.lat?.toFixed(4)}°N, {Math.abs(data.lon)?.toFixed(4)}°W
          </div>
        )}
      </div>
      {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700">{error}</div>}
      {loading && !results.length && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="rounded-2xl border border-[var(--border)] bg-white h-[180px] animate-pulse" />)}
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((r, i) => <NearbyCard key={r.id} r={r} onPick={onPick} delay={i*60} />)}
      </div>
    </section>
  );
}

function NearbyCard({ r, onPick, delay = 0 }) {
  const order = ["doordash", "ubereats", "grubhub"];
  return (
    <button
      type="button"
      data-testid={`nearby-${r.id}`}
      onClick={() => onPick?.(r)}
      style={{ animationDelay: `${delay}ms` }}
      className="text-left fade-up rounded-2xl border border-[var(--border)] bg-white p-5 hover:border-[var(--cobalt)] hover:shadow-[0_18px_40px_-18px_rgba(61,90,254,.30)] transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-bold text-[var(--text)] truncate">{r.name}</div>
          <div className="text-xs text-[var(--muted)] mt-0.5 truncate">{r.cuisine}</div>
          <div className="text-[11px] text-[var(--muted-2)] mt-1 inline-flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> {r.neighborhood} · {r.distance_mi} mi
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--muted-2)] font-bold">Cheapest fee</div>
          <div className="mono text-2xl font-extrabold text-[var(--green)] tabular leading-none mt-1">${r.cheapest_delivery_fee.toFixed(2)}</div>
          <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: PLATFORMS[r.cheapest_platform]?.color }}>{PLATFORMS[r.cheapest_platform]?.label}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {order.map(plat => {
          const p = r.platforms[plat];
          if (!p) return null;
          const isWinner = plat === r.cheapest_platform && p.available;
          return (
            <div
              key={plat}
              className={`rounded-lg border px-2 py-2 text-center ${
                !p.available ? "border-[var(--border)] bg-[var(--surface-2)] opacity-50" :
                isWinner ? "border-[var(--green)]/50 bg-[var(--green-soft)]" :
                "border-[var(--border)] bg-[var(--surface-2)]"
              }`}
            >
              <div className="text-[9px] uppercase tracking-widest font-bold" style={{ color: PLATFORMS[plat].color }}>{PLATFORMS[plat].label}</div>
              <div className={`mono text-sm font-bold mt-0.5 tabular ${isWinner ? "text-[var(--green)]" : "text-[var(--text)]"}`}>
                {p.available ? `$${p.delivery_fee.toFixed(2)}` : "—"}
              </div>
              <div className="text-[10px] text-[var(--muted-2)] mt-0.5 inline-flex items-center gap-1 justify-center">
                <Timer className="w-2.5 h-2.5" /> {p.eta_minutes ? `${p.eta_minutes}m` : "—"}
              </div>
            </div>
          );
        })}
      </div>
      {r.fee_spread > 0 && (
        <div className="mt-3 text-[11px] text-[var(--muted)]">
          <span className="mono font-semibold text-[var(--text)]">${r.fee_spread.toFixed(2)}</span> fee spread across platforms
        </div>
      )}
    </button>
  );
}

function ScraperHealthSection() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/scraper-health`);
      setHealth(r.data);
    } catch (e) {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tone = (s) => s === "green" ? "green" : s === "yellow" ? "amber" : "red";
  const dotColor = (s) => s === "green" ? "var(--green)" : s === "yellow" ? "var(--amber)" : "#ef4444";

  return (
    <section id="health" className="max-w-[1320px] mx-auto px-8 pb-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
          <div>
            <Pill tone="muted" className="mb-2"><Wifi className="w-3 h-3" /> Scraper diagnostics</Pill>
            <h3 className="text-xl font-extrabold tracking-tight">Selector health</h3>
            <p className="text-xs text-[var(--muted)] mt-1">Live HEAD probes + selector freshness for each platform.</p>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <div data-testid="health-overall" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold"
                   style={{ borderColor: dotColor(health.overall), color: dotColor(health.overall), background: "rgba(255,255,255,.02)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: dotColor(health.overall), boxShadow: `0 0 10px ${dotColor(health.overall)}` }} />
                Overall {health.overall.toUpperCase()}
              </div>
            )}
            <button data-testid="health-refresh" onClick={load} disabled={loading} className="text-xs text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Re-probe
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(health?.platforms || [{platform:"doordash"},{platform:"ubereats"},{platform:"grubhub"}]).map((p) => (
            <div key={p.platform} data-testid={`health-${p.platform}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: PLATFORMS[p.platform].color }}>
                  {PLATFORMS[p.platform].label}
                </div>
                {p.status && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: dotColor(p.status) }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor(p.status) }} />
                    {p.status}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div>
                  <div className="text-[var(--muted-2)] uppercase tracking-wider text-[9px]">HTTP</div>
                  <div className="mono text-[var(--text)]">{p.http_status || "—"}</div>
                </div>
                <div>
                  <div className="text-[var(--muted-2)] uppercase tracking-wider text-[9px]">Latency</div>
                  <div className="mono text-[var(--text)]">{p.latency_ms != null ? `${p.latency_ms} ms` : "—"}</div>
                </div>
                <div>
                  <div className="text-[var(--muted-2)] uppercase tracking-wider text-[9px]">Selectors</div>
                  <div className="mono text-[var(--text)]">{p.selector_count ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[var(--muted-2)] uppercase tracking-wider text-[9px]">Verified</div>
                  <div className="mono text-[var(--text)]">{p.days_since_verified != null ? `${p.days_since_verified}d ago` : "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InstallSection() {
  const steps = [
    "Open chrome://extensions in your browser",
    "Enable Developer mode (top-right toggle)",
    'Click "Load unpacked" and select the /app/extension folder',
    "Pin DunaSavvy and start adding items on any delivery site",
  ];
  return (
    <section id="install" className="max-w-[1320px] mx-auto px-8 pb-24">
      <div className="rounded-3xl border border-[var(--border-2)] bg-gradient-to-br from-white to-[var(--surface-2)] p-10 grid lg:grid-cols-[1.1fr_1fr] gap-10 shadow-[0_24px_60px_-30px_rgba(13,148,136,.20)]">
        <div>
          <Pill tone="teal" className="mb-3"><Download className="w-3 h-3" /> Chrome Manifest V3</Pill>
          <h2 className="text-3xl font-extrabold tracking-tight">Drop the engine in your browser</h2>
          <p className="text-[var(--muted)] mt-3 text-sm leading-relaxed max-w-md">
            The extension is a thin scraper — the heavy lifting (AI matching, gouging math) runs on the FastAPI brain. That keeps it fast and resilient when delivery sites change their DOM.
          </p>
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mono w-6 h-6 rounded-full bg-[var(--teal-600)] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-[var(--text)]">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7 flex flex-wrap gap-3">
            <a data-testid="install-zip-btn" href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--teal-500)] text-white font-semibold hover:bg-[var(--teal-400)] transition-colors shadow-[0_8px_24px_rgba(20,184,166,.35)]">
              <Download className="w-4 h-4" /> /app/extension folder
            </a>
            <a href="https://developer.chrome.com/docs/extensions/mv3/getstarted/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[var(--border-2)] bg-white hover:border-[var(--teal-500)] transition-colors text-sm text-[var(--text)]">
              MV3 docs <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[#020a0c] p-5 font-mono text-[12px] leading-relaxed text-[var(--teal-100)] relative">
          <button
            data-testid="copy-btn"
            onClick={() => navigator.clipboard.writeText("/app/extension")}
            className="absolute top-3 right-3 p-1.5 rounded-md border border-[var(--border)] hover:border-[var(--teal-400)] text-[var(--muted)] hover:text-white transition-colors"
            title="Copy folder path"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <div className="text-[var(--muted-2)]"># DunaSavvy file tree</div>
          <pre className="mt-3 text-[var(--teal-200)]">{`extension/
├─ manifest.json        # MV3 declaration
├─ background.js        # Router (service worker)
├─ content.js           # Multi-site scraper
├─ offscreen.html|js    # Cross-site fetch worker
├─ config.js            # BACKEND_URL
├─ popup/
│  ├─ popup.html
│  ├─ popup.css
│  └─ popup.js          # 3-column UI
└─ icons/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png`}</pre>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-8">
      <div className="max-w-[1320px] mx-auto px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal-400)]" />
          DunaSavvy · The cheapest landed cost wins.
        </div>
        <div className="flex items-center gap-5">
          <a href="#engine" className="hover:text-[var(--text)]">Engine</a>
          <a href="#cart" className="hover:text-[var(--text)]">Ghost cart</a>
          <a href="#install" className="hover:text-[var(--text)]">Install</a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState("default");
  const [location, setLocation] = useState(null);
  const [scanning, setScanning] = useState(false);

  const load = async (sc = scenario) => {
    setLoading(true); setError("");
    try {
      const url = sc === "default" ? `${API}/demo-comparison` : `${API}/demo-comparison?scenario=${sc}`;
      const res = await axios({ method: sc === "default" ? "GET" : "POST", url });
      setData(res.data);
    } catch (e) {
      setError(`Failed to load comparison — ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load("default"); /* eslint-disable-next-line */ }, []);
  useEffect(() => { load(scenario); /* eslint-disable-next-line */ }, [scenario]);

  const onScrollToEngine = () => document.getElementById("engine")?.scrollIntoView({ behavior: "smooth" });

  const onSearch = async (payload) => {
    setLocation(payload);
    setScanning(true);
    try {
      const res = await axios.post(`${API}/search`, payload);
      setTimeout(() => {
        setData(res.data);
        setScanning(false);
        document.getElementById("engine")?.scrollIntoView({ behavior: "smooth" });
      }, 1400);
    } catch (e) {
      setScanning(false);
      setError(`Search failed — ${e?.message || e}`);
    }
  };

  return (
    <div className="App grain min-h-screen">
      {BACKEND_MISSING && (
        <div data-testid="backend-missing-banner" className="bg-[var(--amber)] text-white text-xs font-semibold text-center py-2 px-4">
          Backend URL not configured. Set <span className="mono bg-black/15 px-1.5 py-0.5 rounded">BACKEND_URL</span> as a repo secret in GitHub Actions, then redeploy. The buttons below won't load real data until then.
        </div>
      )}
      <Header onScenario={setScenario} scenario={scenario} onRefresh={() => load(scenario)} loading={loading} />
      <Hero onScrollToEngine={onScrollToEngine} onSearch={onSearch} location={location} scanning={scanning} extensionId={extensionId} />
      <NearbyResults data={nearby} loading={nearbyLoading} error={nearbyError} onPick={(r) => document.getElementById("engine")?.scrollIntoView({ behavior: "smooth" })} />
      <FeatureRow />
      <EngineSection data={data} loading={loading} error={error} location={location} />
      <ScraperHealthSection />
      <CartSection data={data} />
      <InstallSection />
      <Footer />
    </div>
  );
}
