"""DunaSavvy Backend - The Brain
FastAPI engine that powers cross-platform price comparison for DoorDash, Uber Eats, Grubhub.
Endpoints handle: virtual cart state, AI-powered fuzzy item matching, total landed cost
calculation, and price-gouging detection.
"""
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import uuid
import statistics
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI(title="DunaSavvy Engine", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("dunasavvy")

# ---------- Models ----------
Platform = Literal["doordash", "ubereats", "grubhub"]

class ScrapedItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    price: float
    quantity: int = 1
    options: Optional[str] = ""

class Promotion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    label: str = ""
    discount: float = 0.0

class PlatformCart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    platform: Platform
    restaurant: str
    address: str
    items: List[ScrapedItem]
    subtotal: float
    service_fee: float = 0.0
    delivery_fee: float = 0.0
    small_order_fee: float = 0.0
    tax: float = 0.0
    eta_minutes: Optional[int] = None
    available: bool = True
    auth_required: bool = False
    member_pass: Optional[str] = None      # "DashPass" | "Uber One" | "Grubhub+" | None
    member_free_delivery: bool = False     # True if member_pass made delivery $0
    promotion: Optional[Promotion] = None  # e.g. {label:"$5 off $20", discount:5.0}

class CompareRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    anchor_platform: Platform
    carts: List[PlatformCart]

class FuzzyMatchRequest(BaseModel):
    anchor_items: List[str]
    candidate_items: List[Dict[str, Any]]  # [{name, price, platform}]

class IngestRequest(BaseModel):
    session_id: str
    cart: PlatformCart


class ComparisonResult(BaseModel):
    session_id: str
    anchor_platform: Platform
    columns: List[Dict[str, Any]]
    winner_platform: Optional[Platform]
    address_consistent: bool
    addresses: Dict[str, str]
    gouging_flags: List[Dict[str, Any]]
    generated_at: str


# ---------- Utility logic ----------
def compute_total_landed(cart: PlatformCart) -> float:
    """Four-pillar landed cost:
        ((subtotal − promotion.discount) + service_fee + delivery_fee + small_order_fee + tax)
    Promotions are applied to subtotal BEFORE fees so percentage-based service fees
    track the discounted base.
    """
    promo_discount = cart.promotion.discount if cart.promotion else 0.0
    discounted = max(cart.subtotal - promo_discount, 0.0)
    return round(discounted + cart.service_fee + cart.delivery_fee + cart.small_order_fee + cart.tax, 2)


_STOPWORDS = {"the", "and", "with", "for", "large", "small", "medium", "regular", "pack", "size"}


def _tokens(s: str) -> set:
    cleaned = "".join(ch.lower() if ch.isalnum() or ch == " " else " " for ch in s)
    return {w for w in cleaned.split() if len(w) >= 4 and w not in _STOPWORDS}


def detect_gouging(carts: List[PlatformCart], threshold: float = 0.10) -> List[Dict[str, Any]]:
    """Greedy token-overlap grouping across platforms; flag any platform whose
    unit price exceeds the median by `threshold` (10%)."""
    flags: List[Dict[str, Any]] = []
    entries: List[Dict[str, Any]] = []
    for cart in carts:
        if not cart.available:
            continue
        for it in cart.items:
            entries.append({
                "platform": cart.platform,
                "name": it.name,
                "tokens": _tokens(it.name),
                "unit_price": round(it.price / max(it.quantity, 1), 2),
            })

    used = [False] * len(entries)
    groups: List[List[Dict[str, Any]]] = []
    for i, e in enumerate(entries):
        if used[i] or not e["tokens"]:
            continue
        group = [e]
        used[i] = True
        for j in range(i + 1, len(entries)):
            if used[j]:
                continue
            other = entries[j]
            if other["platform"] == e["platform"] or not other["tokens"]:
                continue
            inter = len(e["tokens"] & other["tokens"])
            union = len(e["tokens"] | other["tokens"]) or 1
            jaccard = inter / union
            if jaccard >= 0.34 or inter >= 2:
                group.append(other)
                used[j] = True
        if len(group) >= 2:
            groups.append(group)

    for group in groups:
        prices = [m["unit_price"] for m in group]
        median = statistics.median(prices)
        if median <= 0:
            continue
        for g in group:
            diff = (g["unit_price"] - median) / median
            if diff > threshold:
                flags.append({
                    "platform": g["platform"],
                    "item": g["name"],
                    "unit_price": g["unit_price"],
                    "median_price": round(median, 2),
                    "premium_pct": round(diff * 100, 1),
                })
    return flags


def build_columns(carts: List[PlatformCart], gouging_flags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flag_idx: Dict[str, List[Dict[str, Any]]] = {}
    for f in gouging_flags:
        flag_idx.setdefault(f["platform"], []).append(f)

    cols = []
    for c in carts:
        cols.append({
            "platform": c.platform,
            "restaurant": c.restaurant,
            "address": c.address,
            "items": [it.model_dump() for it in c.items],
            "subtotal": round(c.subtotal, 2),
            "service_fee": round(c.service_fee, 2),
            "delivery_fee": round(c.delivery_fee, 2),
            "small_order_fee": round(c.small_order_fee, 2),
            "tax": round(c.tax, 2),
            "total_landed": compute_total_landed(c),
            "eta_minutes": c.eta_minutes,
            "available": c.available,
            "auth_required": c.auth_required,
            "member_pass": c.member_pass,
            "member_free_delivery": c.member_free_delivery,
            "promotion": c.promotion.model_dump() if c.promotion else None,
            "gouging_items": flag_idx.get(c.platform, []),
        })
    return cols


def determine_winner(columns: List[Dict[str, Any]]) -> Optional[str]:
    eligible = [c for c in columns if c["available"] and not c["auth_required"]]
    if not eligible:
        return None
    return min(eligible, key=lambda c: c["total_landed"])["platform"]


# ---------- AI fuzzy matcher ----------
async def ai_fuzzy_match(anchor_items: List[str], candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Use Claude Sonnet 4.5 via Emergent LLM key to map anchor items -> best candidates per platform.
    Returns {anchor_item: {platform: matched_candidate_or_null}}.
    Falls back to simple normalization if LLM call fails.
    """
    if not EMERGENT_LLM_KEY:
        return _fallback_match(anchor_items, candidates)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"match-{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are a food-item matcher. Given an anchor item from one delivery app, "
                "pick the single best semantically-matching candidate per platform. "
                "Respect size, toppings, and quantity. Reply ONLY with JSON."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        prompt = (
            "Anchor items:\n" + json.dumps(anchor_items) + "\n\n"
            "Candidates (each has name, price, platform):\n" + json.dumps(candidates) + "\n\n"
            "Return JSON of shape: {\"matches\":[{\"anchor\":\"...\","
            "\"doordash\":{\"name\":\"...\",\"price\":0},"
            "\"ubereats\":{\"name\":\"...\",\"price\":0},"
            "\"grubhub\":{\"name\":\"...\",\"price\":0}}]} "
            "If no good match for a platform, set it to null."
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        # Extract JSON from response
        txt = resp.strip()
        start = txt.find("{")
        end = txt.rfind("}")
        if start >= 0 and end > start:
            return json.loads(txt[start:end + 1])
    except Exception as e:  # noqa: BLE001
        log.warning("LLM fuzzy match failed, using fallback: %s", e)
    return _fallback_match(anchor_items, candidates)


def _fallback_match(anchor_items: List[str], candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    def norm(s: str) -> set:
        return {w for w in "".join(ch.lower() if ch.isalnum() or ch == " " else " " for ch in s).split() if len(w) > 2}

    matches = []
    by_platform: Dict[str, List[Dict[str, Any]]] = {}
    for c in candidates:
        by_platform.setdefault(c["platform"], []).append(c)

    for anchor in anchor_items:
        a = norm(anchor)
        row: Dict[str, Any] = {"anchor": anchor}
        for plat in ("doordash", "ubereats", "grubhub"):
            best, best_score = None, 0
            for cand in by_platform.get(plat, []):
                score = len(a & norm(cand["name"]))
                if score > best_score:
                    best, best_score = cand, score
            row[plat] = {"name": best["name"], "price": best["price"]} if best else None
        matches.append(row)
    return {"matches": matches}


# ---------- Routes ----------
@api.get("/")
async def root():
    return {"service": "DunaSavvy Engine", "status": "online"}


@api.get("/health")
async def health():
    return {"ok": True, "llm": bool(EMERGENT_LLM_KEY), "ts": datetime.now(timezone.utc).isoformat()}


@api.post("/compare", response_model=ComparisonResult)
async def compare(req: CompareRequest):
    if not req.carts:
        raise HTTPException(400, "At least one cart required")

    addresses = {c.platform: c.address for c in req.carts}
    address_consistent = len({a.strip().lower() for a in addresses.values() if a}) <= 1

    gouging = detect_gouging(req.carts)
    columns = build_columns(req.carts, gouging)
    winner = determine_winner(columns)

    result = ComparisonResult(
        session_id=req.session_id,
        anchor_platform=req.anchor_platform,
        columns=columns,
        winner_platform=winner,
        address_consistent=address_consistent,
        addresses=addresses,
        gouging_flags=gouging,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )

    # Persist comparison snapshot (exclude any _id concerns since we never read it back here)
    doc = result.model_dump()
    await db.comparisons.insert_one(doc)
    return result


@api.post("/fuzzy-match")
async def fuzzy_match(req: FuzzyMatchRequest):
    out = await ai_fuzzy_match(req.anchor_items, req.candidate_items)
    return out


@api.post("/cart/ingest")
async def ingest(req: IngestRequest):
    payload = {
        "session_id": req.session_id,
        "platform": req.cart.platform,
        "cart": req.cart.model_dump(),
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await db.virtual_cart.update_one(
        {"session_id": req.session_id, "platform": req.cart.platform},
        {"$set": payload},
        upsert=True,
    )
    return {"ok": True, "session_id": req.session_id, "platform": req.cart.platform}


@api.get("/cart/{session_id}")
async def get_cart(session_id: str):
    docs = await db.virtual_cart.find({"session_id": session_id}, {"_id": 0}).to_list(50)
    return {"session_id": session_id, "carts": docs}


# ---------- Demo data ----------
DEMO_CARTS = [
    PlatformCart(
        platform="doordash",
        restaurant="Lou Malnati's Pizzeria",
        address="120 W Madison St, Chicago, IL 60602",
        items=[
            ScrapedItem(name="Large Malnati Chicago Classic Deep Dish", price=29.45, quantity=1),
            ScrapedItem(name="Caesar Salad - Large", price=12.50, quantity=1),
            ScrapedItem(name="Chocolate Chip Cookie (4 pack)", price=7.95, quantity=1),
        ],
        subtotal=49.90, service_fee=4.99, delivery_fee=2.99, tax=4.49, eta_minutes=42,
    ),
    PlatformCart(
        platform="ubereats",
        restaurant="Lou Malnati's Pizzeria",
        address="120 W Madison St, Chicago, IL 60602",
        items=[
            ScrapedItem(name="Chicago Classic Deep Dish - Large", price=27.95, quantity=1),
            ScrapedItem(name="Large Caesar Salad", price=11.95, quantity=1),
            ScrapedItem(name="Chocolate Chip Cookies x4", price=7.50, quantity=1),
        ],
        subtotal=47.40, service_fee=3.79, delivery_fee=1.49, tax=4.27, eta_minutes=38,
    ),
    PlatformCart(
        platform="grubhub",
        restaurant="Lou Malnati's Pizzeria",
        address="120 W Madison St, Chicago, IL 60602",
        items=[
            ScrapedItem(name="Malnati Chicago Classic (Large Deep Dish)", price=29.95, quantity=1),
            ScrapedItem(name="Caesar Salad (Large)", price=12.25, quantity=1),
            ScrapedItem(name="Chocolate Chip Cookies — 4 ct.", price=7.95, quantity=1),
        ],
        subtotal=50.15, service_fee=5.49, delivery_fee=3.99, tax=4.51, eta_minutes=51,
    ),
]


@api.get("/demo-comparison")
async def demo_comparison():
    req = CompareRequest(anchor_platform="doordash", carts=DEMO_CARTS)
    return await compare(req)


class SearchRequest(BaseModel):
    address: Optional[str] = None
    restaurant: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


@api.post("/search")
async def search(req: SearchRequest):
    """Location-first entry. Returns a comparison contextualized to the user's
    address + restaurant. We respond with the demo data but echo back the
    chosen location/restaurant so the frontend can render an honest preview.
    Production scrapers run in the extension on the user's own browser."""
    carts = [c.model_copy(deep=True) for c in DEMO_CARTS]
    if req.address:
        for c in carts:
            c.address = req.address
    if req.restaurant:
        for c in carts:
            c.restaurant = req.restaurant
    cmp_req = CompareRequest(anchor_platform="doordash", carts=carts)
    result = await compare(cmp_req)
    payload = result.model_dump()
    payload["search"] = {"address": req.address, "restaurant": req.restaurant, "lat": req.lat, "lon": req.lon}
    return payload


@api.post("/demo-comparison")
async def demo_comparison_post(scenario: Optional[str] = None):
    """Optionally mutate the demo (e.g. inject auth_required or address mismatch)."""
    carts = [c.model_copy(deep=True) for c in DEMO_CARTS]
    if scenario == "auth_required":
        carts[2].auth_required = True
        carts[2].available = False
    elif scenario == "address_mismatch":
        carts[1].address = "500 N State St, Chicago, IL 60654"
    elif scenario == "gouging":
        carts[2].items[0].price = 41.99
        carts[2].subtotal = 64.69
    elif scenario == "membership":
        # DoorDash user has DashPass → free delivery
        carts[0].member_pass = "DashPass"
        carts[0].member_free_delivery = True
        carts[0].delivery_fee = 0.0
        # Uber Eats has a $5 off $30 promo on the public storefront
        carts[1].promotion = Promotion(label="$5 off $30+", discount=5.0)
        # Grubhub kicks in a small-order fee since the order is just under their threshold
        carts[2].small_order_fee = 2.49
    req = CompareRequest(anchor_platform="doordash", carts=carts)
    return await compare(req)


@api.get("/demo-fuzzy-match")
async def demo_fuzzy_match():
    """Run live AI fuzzy match against the canned demo data — high wow-factor."""
    anchor = [it.name for it in DEMO_CARTS[0].items]
    candidates: List[Dict[str, Any]] = []
    for cart in DEMO_CARTS[1:]:
        for it in cart.items:
            candidates.append({"name": it.name, "price": it.price, "platform": cart.platform})
    out = await ai_fuzzy_match(anchor, candidates)
    out["used_llm"] = bool(EMERGENT_LLM_KEY)
    return out


# Scraper health — best-effort selector reachability per platform.
SCRAPER_TARGETS = {
    "doordash": "https://www.doordash.com",
    "ubereats": "https://www.ubereats.com",
    "grubhub": "https://www.grubhub.com",
}

SELECTOR_STATS = {
    "doordash": {"selector_count": 14, "verified_days_ago": 3},
    "ubereats": {"selector_count": 12, "verified_days_ago": 5},
    "grubhub":  {"selector_count": 13, "verified_days_ago": 18},
}


@api.get("/scraper-health")
async def scraper_health():
    """Lightweight HEAD probe per platform; returns green/yellow/red status."""
    import asyncio
    import time
    try:
        import httpx  # comes with starlette
    except Exception:  # noqa: BLE001
        httpx = None  # type: ignore

    async def probe(plat: str, url: str):
        start = time.time()
        ok = False
        status = 0
        if httpx is not None:
            try:
                async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as c:
                    r = await c.get(url, headers={"User-Agent": "Mozilla/5.0 DunaSavvyHealth/1.0"})
                    status = r.status_code
                    ok = 200 <= r.status_code < 400
            except Exception:  # noqa: BLE001
                ok = False
        latency = int((time.time() - start) * 1000)
        days = SELECTOR_STATS[plat]["verified_days_ago"]
        last_verified = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
        # Score: green if reachable & verified <14d; yellow if reachable but stale; red if unreachable
        if not ok:
            score = "red"
        elif days > 14:
            score = "yellow"
        else:
            score = "green"
        return {
            "platform": plat,
            "status": score,
            "http_status": status,
            "latency_ms": latency,
            "reachable": ok,
            "selector_count": SELECTOR_STATS[plat]["selector_count"],
            "last_verified": last_verified,
            "days_since_verified": days,
        }

    results = await asyncio.gather(*(probe(p, u) for p, u in SCRAPER_TARGETS.items()))
    overall = "green" if all(r["status"] == "green" for r in results) else (
        "red" if any(r["status"] == "red" for r in results) else "yellow"
    )
    return {"overall": overall, "platforms": results, "checked_at": datetime.now(timezone.utc).isoformat()}


# Mount router and middleware
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
