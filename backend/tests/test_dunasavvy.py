"""DunaSavvy backend API tests"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ghost-cart-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Health
def test_health(client):
    r = client.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["llm"] is True


# GET demo-comparison (default)
def test_demo_comparison_default(client):
    r = client.get(f"{API}/demo-comparison", timeout=20)
    assert r.status_code == 200
    d = r.json()
    plats = {c["platform"] for c in d["columns"]}
    assert plats == {"doordash", "ubereats", "grubhub"}
    assert d["address_consistent"] is True
    assert d["winner_platform"] in plats
    assert isinstance(d["addresses"], dict) and len(d["addresses"]) == 3
    for c in d["columns"]:
        expected = round(c["subtotal"] + c["service_fee"] + c["delivery_fee"] + c["tax"], 2)
        assert abs(c["total_landed"] - expected) < 0.02


# POST demo gouging scenario
def test_demo_gouging(client):
    r = client.post(f"{API}/demo-comparison?scenario=gouging", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert len(d["gouging_flags"]) >= 1
    f = d["gouging_flags"][0]
    assert {"platform", "item", "premium_pct"}.issubset(f.keys())


# POST demo address mismatch
def test_demo_address_mismatch(client):
    r = client.post(f"{API}/demo-comparison?scenario=address_mismatch", timeout=20)
    assert r.status_code == 200
    assert r.json()["address_consistent"] is False


# POST demo auth required
def test_demo_auth_required(client):
    r = client.post(f"{API}/demo-comparison?scenario=auth_required", timeout=20)
    assert r.status_code == 200
    d = r.json()
    auth_cols = [c for c in d["columns"] if c["auth_required"] is True and c["available"] is False]
    assert len(auth_cols) == 1


# POST /api/compare with custom carts
def test_compare_custom(client):
    payload = {
        "anchor_platform": "doordash",
        "carts": [
            {"platform": "doordash", "restaurant": "X", "address": "1 A St",
             "items": [{"name": "Pepperoni Pizza", "price": 20, "quantity": 1}],
             "subtotal": 20, "service_fee": 2, "delivery_fee": 3, "tax": 1.5},
            {"platform": "ubereats", "restaurant": "X", "address": "1 A St",
             "items": [{"name": "Pepperoni Pizza Large", "price": 19, "quantity": 1}],
             "subtotal": 19, "service_fee": 1.5, "delivery_fee": 2, "tax": 1.3},
            {"platform": "grubhub", "restaurant": "X", "address": "1 A St",
             "items": [{"name": "Large Pepperoni", "price": 22, "quantity": 1}],
             "subtotal": 22, "service_fee": 3, "delivery_fee": 4, "tax": 2},
        ],
    }
    r = client.post(f"{API}/compare", json=payload, timeout=20)
    assert r.status_code == 200
    d = r.json()
    totals = {c["platform"]: c["total_landed"] for c in d["columns"]}
    assert totals["doordash"] == 26.5
    assert totals["ubereats"] == 23.8
    assert totals["grubhub"] == 31.0
    assert d["winner_platform"] == "ubereats"


# Cart ingest + get
def test_cart_ingest_and_get(client):
    sid = f"TEST_{uuid.uuid4().hex[:8]}"
    payload = {
        "session_id": sid,
        "cart": {
            "platform": "doordash", "restaurant": "R", "address": "1 A St",
            "items": [{"name": "Burger", "price": 10, "quantity": 1}],
            "subtotal": 10, "service_fee": 1, "delivery_fee": 2, "tax": 1,
        },
    }
    r = client.post(f"{API}/cart/ingest", json=payload, timeout=15)
    assert r.status_code == 200
    assert r.json()["ok"] is True

    g = client.get(f"{API}/cart/{sid}", timeout=15)
    assert g.status_code == 200
    body = g.json()
    assert body["session_id"] == sid
    assert len(body["carts"]) == 1
    # Ensure no _id leak
    assert "_id" not in body["carts"][0]
    assert body["carts"][0]["platform"] == "doordash"


# Fuzzy match
def test_fuzzy_match(client):
    payload = {
        "anchor_items": ["Large Pepperoni Pizza"],
        "candidate_items": [
            {"name": "Pepperoni Pizza - Large", "price": 18, "platform": "doordash"},
            {"name": "Large Pepperoni", "price": 17, "platform": "ubereats"},
            {"name": "Cheese Pizza", "price": 15, "platform": "grubhub"},
        ],
    }
    r = client.post(f"{API}/fuzzy-match", json=payload, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert "matches" in d
    assert isinstance(d["matches"], list)
    assert len(d["matches"]) >= 1
