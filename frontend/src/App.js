import { useEffect, useMemo, useState } from "react";
import "@/App.css";
import axios from "axios";
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Check, ChevronRight,
  Copy, Download, Eye, Flame, Github, MapPin, RefreshCw, ShieldCheck,
  Sparkles, Timer, TrendingDown, Truck, Zap,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PLATFORMS = {
  doordash: { label: "DoorDash", short: "DD", color: "#ef2a44" },
  ubereats: { label: "Uber Eats", short: "UE", color: "#06c167" },
  grubhub:  { label: "Grubhub",  short: "GH", color: "#f63440" },
};

const fmt$ = (n) => `$${(Number(n) || 0).toFixed(2)}`;

function Pill({ children, tone = "teal", className = "" }) {
  const tones = {
    teal:   "bg-[rgba(20,184,166,.1)] text-[#5eead4] border-[#134e4a]",
    amber:  "bg-[rgba(245,158,11,.1)] text-[#fcd34d] border-[#78350f]",
    green:  "bg-[rgba(34,197,94,.1)]  text-[#86efac] border-[#14532d]",
    muted:  "bg-[rgba(255,255,255,.04)] text-[#84b9b6] border-[#15404a]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium tracking-wide ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

function Header({ onScenario, scenario, onRefresh, loading }) {
  return (
    <header data-testid="app-header" className="sticky top-0 z-30 backdrop-blur-md bg-[rgba(6,20,26,.7)] border-b border-[var(--border)]">
      <div className="max-w-[1320px] mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--teal-500)] to-[var(--teal-700)] flex items-center justify-center shadow-[0_0_24px_rgba(20,184,166,.35)]">
            <Zap className="w-5 h-5 text-[#04181a]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-lg leading-none">DunaSavvy</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mt-1">Delivery price engine</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-[var(--muted)]">
          <a href="#engine" className="hover:text-white transition-colors">Engine</a>
          <a href="#cart" className="hover:text-white transition-colors">Virtual cart</a>
          <a href="#install" className="hover:text-white transition-colors">Install</a>
        </nav>
        <div className="flex items-center gap-2">
          <select
            data-testid="scenario-select"
            value={scenario}
            onChange={(e) => onScenario(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] text-sm px-3 py-2 rounded-lg outline-none focus:border-[var(--teal-500)]"
          >
            <option value="default">Default scenario</option>
            <option value="gouging">Gouging detected</option>
            <option value="address_mismatch">Address mismatch</option>
            <option value="auth_required">Auth required</option>
          </select>
          <button
            data-testid="refresh-btn"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--teal-600)] hover:bg-[var(--teal-500)] text-[#04181a] font-semibold text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Re-run
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onScrollToEngine }) {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-[1320px] mx-auto px-8 pt-14 pb-10 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-end">
        <div className="fade-up">
          <Pill tone="teal" className="mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--teal-400)] animate-pulse" />
            Live engine · Claude Sonnet 4.5
          </Pill>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.025em] leading-[1.02]">
            One cart.<br />
            <span className="text-[var(--teal-400)]">Three platforms.</span><br />
            The cheapest landed cost wins.
          </h1>
          <p className="mt-6 text-base text-[var(--muted)] max-w-xl leading-relaxed">
            DunaSavvy scrapes your active cart on DoorDash, Uber Eats, or Grubhub and uses an
            AI fuzzy-matcher to compare the same items across all three — including service
            fees, delivery fees and tax. Real comparison, no marketing noise.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              data-testid="hero-engine-btn"
              onClick={onScrollToEngine}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--teal-500)] hover:bg-[var(--teal-400)] text-[#04181a] font-semibold transition-transform hover:-translate-y-0.5"
            >
              See it live <ArrowRight className="w-4 h-4" />
            </button>
            <a
              data-testid="hero-install-btn"
              href="#install"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[var(--border-2)] hover:border-[var(--teal-400)] text-white font-semibold transition-colors"
            >
              <Download className="w-4 h-4" /> Install extension
            </a>
          </div>
          <div className="mt-10 grid grid-cols-3 max-w-md gap-6">
            {[
              { k: "<2s", v: "Cross-platform compare" },
              { k: "10%+", v: "Gouging threshold" },
              { k: "MV3", v: "Manifest version" },
            ].map((s) => (
              <div key={s.v}>
                <div className="mono text-2xl text-white font-bold tabular">{s.k}</div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-2)] mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <HeroVisual />
      </div>
      <div className="tick-bar max-w-[1320px] mx-auto" />
    </section>
  );
}

function HeroVisual() {
  return (
    <div data-testid="hero-visual" className="relative fade-up">
      <div className="absolute -inset-6 bg-gradient-to-br from-[var(--teal-700)]/30 to-transparent blur-2xl rounded-3xl" />
      <div className="relative rounded-2xl border border-[var(--border-2)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Activity className="w-3.5 h-3.5 text-[var(--teal-400)]" />
            Comparison snapshot
          </div>
          <Pill tone="green"><Check className="w-3 h-3" /> Address synced</Pill>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { p: "doordash", t: 41.92, eta: 42 },
            { p: "ubereats", t: 38.90, eta: 38, win: true },
            { p: "grubhub",  t: 49.18, eta: 51, gouge: true },
          ].map((c) => (
            <div key={c.p} className={`relative rounded-xl border p-3 ${c.win ? "border-[var(--green)] bg-[rgba(34,197,94,.06)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
              {c.win && <span className="absolute top-2 right-2 text-[9px] tracking-widest text-[var(--green)]">BEST</span>}
              {c.gouge && <span className="absolute top-2 right-2"><AlertTriangle className="w-3.5 h-3.5 text-[var(--amber)]" /></span>}
              <div className="text-[10px] uppercase tracking-widest" style={{ color: PLATFORMS[c.p].color }}>{PLATFORMS[c.p].label}</div>
              <div className="mono text-xl font-bold mt-2">{fmt$(c.t)}</div>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--muted-2)]"><Timer className="w-3 h-3" /> {c.eta} min</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-[rgba(13,148,136,.08)] border border-[rgba(13,148,136,.3)] text-xs text-[var(--teal-100)] flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--teal-300)]" />
          AI matched 3 items across platforms · saves <span className="mono text-white font-semibold ml-1">$3.02</span>
        </div>
      </div>
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
              <span className="text-white">{v}</span>
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
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: PLATFORMS[col.platform].color }}>
            {PLATFORMS[col.platform].label}
          </div>
          <div className="text-sm font-semibold text-white mt-1 truncate max-w-[220px]">{col.restaurant || "—"}</div>
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
              <span className="mono text-white tabular shrink-0">{fmt$(it.price)}</span>
            </div>
          );
        }) : (
          <div className="text-sm text-[var(--muted-2)] italic">{col.auth_required ? "Open the platform & sign in to fetch this cart." : "No items"}</div>
        )}
      </div>

      <div className="border-t border-dashed border-[var(--border)] pt-3 flex flex-col gap-1.5 text-xs text-[var(--muted)]">
        {[
          ["Subtotal", col.subtotal],
          ["Service fee", col.service_fee],
          ["Delivery", col.delivery_fee],
          ["Tax", col.tax],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between"><span>{k}</span><span className="mono tabular text-[var(--text)]">{fmt$(v)}</span></div>
        ))}
      </div>

      <div className="mt-auto flex items-end justify-between">
        <div className="text-[11px] uppercase tracking-widest text-[var(--muted-2)]">Total landed</div>
        <div className={`mono font-extrabold text-3xl tabular ${isWinner ? "text-[var(--green)]" : "text-white"}`}>
          {fmt$(col.total_landed)}
        </div>
      </div>
    </div>
  );
}

function EngineSection({ data, loading, error }) {
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
          <Pill tone="muted" className="mb-3"><Activity className="w-3 h-3" /> Live comparison</Pill>
          <h2 className="text-3xl font-extrabold tracking-tight">The Price Engine</h2>
          <p className="text-[var(--muted)] mt-2 max-w-xl text-sm">
            Three platforms scraped, AI-matched, and ranked by total landed cost. Re-run scenarios above to see gouging, auth and address-guard flows.
          </p>
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
                <div className="text-white truncate" title={g.item}>{g.item}</div>
                <div className="flex justify-between mt-2 text-xs text-[var(--muted)]">
                  <span>This: <span className="mono text-white">{fmt$(g.unit_price)}</span></span>
                  <span>Median: <span className="mono text-white">{fmt$(g.median_price)}</span></span>
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
  if (!data) return null;
  const allItems = data.columns.flatMap((c) =>
    c.items.map((it) => ({ ...it, platform: c.platform })),
  );
  const grouped = {};
  for (const it of allItems) {
    const key = it.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 22);
    (grouped[key] ||= []).push(it);
  }

  return (
    <section id="cart" className="max-w-[1320px] mx-auto px-8 py-16">
      <Pill tone="muted" className="mb-3"><Sparkles className="w-3 h-3" /> AI-matched virtual cart</Pill>
      <h2 className="text-3xl font-extrabold tracking-tight mb-2">The Ghost Cart</h2>
      <p className="text-[var(--muted)] text-sm max-w-2xl mb-8">
        Each row is one logical item; columns show what each platform calls it and what they charge.
      </p>
      <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface)] overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] border-b border-[var(--border)] px-5 py-3 font-bold">
          <div>Item</div><div>DoorDash</div><div>Uber Eats</div><div>Grubhub</div>
        </div>
        {Object.entries(grouped).map(([k, group], i) => {
          const byP = Object.fromEntries(group.map((g) => [g.platform, g]));
          const prices = Object.values(byP).map((g) => g.price);
          const minP = Math.min(...prices);
          return (
            <div key={k} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] px-5 py-4 border-b border-[var(--border)]/50 last:border-0 items-center text-sm hover:bg-[var(--surface-2)] transition-colors fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="text-white truncate pr-4">{group[0].name.replace(/[-—–].*$/, "").trim() || group[0].name}</div>
              {["doordash", "ubereats", "grubhub"].map((p) => {
                const item = byP[p];
                if (!item) return <div key={p} className="text-[var(--muted-2)]">—</div>;
                const isMin = item.price === minP;
                return (
                  <div key={p} className="flex flex-col">
                    <span className={`mono tabular font-semibold ${isMin ? "text-[var(--green)]" : "text-white"}`}>{fmt$(item.price)}</span>
                    <span className="text-[10px] text-[var(--muted-2)] truncate" title={item.name}>{item.name}</span>
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

function InstallSection() {
  const steps = [
    "Open chrome://extensions in your browser",
    "Enable Developer mode (top-right toggle)",
    'Click "Load unpacked" and select the /app/extension folder',
    "Pin DunaSavvy and start adding items on any delivery site",
  ];
  return (
    <section id="install" className="max-w-[1320px] mx-auto px-8 pb-24">
      <div className="rounded-3xl border border-[var(--border-2)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface)] p-10 grid lg:grid-cols-[1.1fr_1fr] gap-10">
        <div>
          <Pill tone="teal" className="mb-3"><Download className="w-3 h-3" /> Chrome Manifest V3</Pill>
          <h2 className="text-3xl font-extrabold tracking-tight">Drop the engine in your browser</h2>
          <p className="text-[var(--muted)] mt-3 text-sm leading-relaxed max-w-md">
            The extension is a thin scraper — the heavy lifting (AI matching, gouging math) runs on the FastAPI brain. That keeps it fast and resilient when delivery sites change their DOM.
          </p>
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mono w-6 h-6 rounded-full bg-[var(--teal-700)] text-[var(--teal-100)] flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-white/90">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7 flex flex-wrap gap-3">
            <a data-testid="install-zip-btn" href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--teal-500)] text-[#04181a] font-semibold hover:bg-[var(--teal-400)] transition-colors">
              <Download className="w-4 h-4" /> /app/extension folder
            </a>
            <a href="https://developer.chrome.com/docs/extensions/mv3/getstarted/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[var(--border-2)] hover:border-[var(--teal-400)] transition-colors text-sm">
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
          <a href="#engine" className="hover:text-white">Engine</a>
          <a href="#cart" className="hover:text-white">Ghost cart</a>
          <a href="#install" className="hover:text-white">Install</a>
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

  return (
    <div className="App grain min-h-screen">
      <Header onScenario={setScenario} scenario={scenario} onRefresh={() => load(scenario)} loading={loading} />
      <Hero onScrollToEngine={onScrollToEngine} />
      <FeatureRow />
      <EngineSection data={data} loading={loading} error={error} />
      <CartSection data={data} />
      <InstallSection />
      <Footer />
    </div>
  );
}
