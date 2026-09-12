import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from main import app
from app.core.database import AsyncSessionLocal, engine
from app.core.security import create_access_token

@pytest_asyncio.fixture(scope="function")
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await engine.dispose()

def get_prosumer_headers():
    token = create_access_token(subject="11111111-1111-1111-1111-111111111111")
    return {"Authorization": f"Bearer {token}"}

def get_consumer_headers():
    token = create_access_token(subject="22222222-2222-2222-2222-222222222222")
    return {"Authorization": f"Bearer {token}"}

def get_dual_headers():
    token = create_access_token(subject="33333333-3333-3333-3333-333333333333")
    return {"Authorization": f"Bearer {token}"}

def get_admin_headers():
    token = create_access_token(subject="55555555-5555-5555-5555-555555555555")
    return {"Authorization": f"Bearer {token}"}



# =========================================================================
# LISTINGS TESTS
# =========================================================================

async def test_prosumer_can_create_listing(client: AsyncClient):
    headers = get_prosumer_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Satellite Solar Array Surplus",
        "energy_available_kwh": 45.0,
        "price_per_kwh": 5.90,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=6)).isoformat(),
        "source_type": "solar_rooftop",
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }
    resp = await client.post("/api/v1/listings/", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Satellite Solar Array Surplus"
    assert data["energy_available_kwh"] == 45.0
    assert data["energy_remaining_kwh"] == 45.0
    assert data["price_per_kwh"] == 5.90
    assert data["status"] == "active"
    assert data["latitude"] == 23.0300
    assert data["longitude"] == 72.5180

async def test_consumer_cannot_create_listing(client: AsyncClient):
    headers = get_consumer_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Unauthorized Listing by Consumer",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 6.00,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }
    resp = await client.post("/api/v1/listings/", json=payload, headers=headers)
    assert resp.status_code == 403
    assert "prosumers or dual" in resp.json()["detail"].lower()

async def test_admin_cannot_create_listing(client: AsyncClient):
    headers = get_admin_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Unauthorized Listing by Admin",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 6.00,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }
    resp = await client.post("/api/v1/listings/", json=payload, headers=headers)
    assert resp.status_code == 403
    assert "prosumers or dual" in resp.json()["detail"].lower()


async def test_dual_can_create_listing(client: AsyncClient):
    headers = get_dual_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Dual User BESS Surplus",
        "energy_available_kwh": 25.0,
        "price_per_kwh": 6.10,
        "available_from": (now + timedelta(hours=2)).isoformat(),
        "available_to": (now + timedelta(hours=7)).isoformat(),
        "source_type": "solar_battery",
        "latitude": 23.0118,
        "longitude": 72.5074
    }
    resp = await client.post("/api/v1/listings/", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["source_type"] == "solar_battery"

async def test_listing_invalid_inputs(client: AsyncClient):
    headers = get_prosumer_headers()
    now = datetime.now(timezone.utc)
    
    # Invalid negative energy
    resp1 = await client.post("/api/v1/listings/", json={
        "title": "Test",
        "energy_available_kwh": -10.0,
        "price_per_kwh": 5.0,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=4)).isoformat()
    }, headers=headers)
    assert resp1.status_code == 422

    # Invalid time window (available_to <= available_from)
    resp2 = await client.post("/api/v1/listings/", json={
        "title": "Test",
        "energy_available_kwh": 10.0,
        "price_per_kwh": 5.0,
        "available_from": (now + timedelta(hours=5)).isoformat(),
        "available_to": (now + timedelta(hours=2)).isoformat()
    }, headers=headers)
    assert resp2.status_code == 422

async def test_listing_ownership_update_and_cancel(client: AsyncClient):
    p_headers = get_prosumer_headers()
    c_headers = get_consumer_headers()
    now = datetime.now(timezone.utc)
    
    # 1. Prosumer creates listing
    create_resp = await client.post("/api/v1/listings/", json={
        "title": "Updatable Solar Listing",
        "energy_available_kwh": 50.0,
        "price_per_kwh": 5.75,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }, headers=p_headers)
    assert create_resp.status_code == 201
    listing_id = create_resp.json()["id"]

    # 2. Consumer attempts to update it -> 403
    unauth_resp = await client.put(f"/api/v1/listings/{listing_id}", json={
        "price_per_kwh": 4.00
    }, headers=c_headers)
    assert unauth_resp.status_code == 403

    # 3. Owner updates it -> 200
    update_resp = await client.put(f"/api/v1/listings/{listing_id}", json={
        "price_per_kwh": 5.60,
        "title": "Discounted Solar Surplus"
    }, headers=p_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["price_per_kwh"] == 5.60
    assert update_resp.json()["title"] == "Discounted Solar Surplus"

    # 4. Owner cancels it -> 200
    cancel_resp = await client.delete(f"/api/v1/listings/{listing_id}", headers=p_headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"

# =========================================================================
# REQUIREMENTS TESTS
# =========================================================================

async def test_consumer_can_create_requirement(client: AsyncClient):
    headers = get_consumer_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "EV Charging Demand Navrangpura",
        "energy_required_kwh": 25.0,
        "max_price_per_kwh": 6.80,
        "required_from": (now + timedelta(hours=1)).isoformat(),
        "required_to": (now + timedelta(hours=6)).isoformat(),
        "max_radius_km": 10.0,
        "min_seller_reliability": 80.0,
        "latitude": 23.0350,
        "longitude": 72.5600,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }
    resp = await client.post("/api/v1/requirements/", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "EV Charging Demand Navrangpura"
    assert data["energy_required_kwh"] == 25.0
    assert data["max_price_per_kwh"] == 6.80
    assert data["status"] == "open"
    assert data["latitude"] == 23.0350

async def test_prosumer_cannot_create_requirement(client: AsyncClient):
    headers = get_prosumer_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Prosumer Trying Demand",
        "energy_required_kwh": 15.0,
        "max_price_per_kwh": 6.00,
        "required_from": (now + timedelta(hours=1)).isoformat(),
        "required_to": (now + timedelta(hours=4)).isoformat()
    }
    resp = await client.post("/api/v1/requirements/", json=payload, headers=headers)
    assert resp.status_code == 403
    assert "consumers or dual" in resp.json()["detail"].lower()

async def test_admin_cannot_create_requirement(client: AsyncClient):
    headers = get_admin_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Admin Trying Demand",
        "energy_required_kwh": 15.0,
        "max_price_per_kwh": 6.00,
        "required_from": (now + timedelta(hours=1)).isoformat(),
        "required_to": (now + timedelta(hours=4)).isoformat()
    }
    resp = await client.post("/api/v1/requirements/", json=payload, headers=headers)
    assert resp.status_code == 403
    assert "consumers or dual" in resp.json()["detail"].lower()


async def test_dual_can_create_requirement(client: AsyncClient):
    headers = get_dual_headers()
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Dual User BESS Topup",
        "energy_required_kwh": 18.0,
        "max_price_per_kwh": 6.30,
        "required_from": (now + timedelta(hours=2)).isoformat(),
        "required_to": (now + timedelta(hours=5)).isoformat()
    }
    resp = await client.post("/api/v1/requirements/", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["energy_required_kwh"] == 18.0

async def test_requirement_invalid_inputs(client: AsyncClient):
    headers = get_consumer_headers()
    now = datetime.now(timezone.utc)

    # Invalid negative price
    resp = await client.post("/api/v1/requirements/", json={
        "title": "Test",
        "energy_required_kwh": 10.0,
        "max_price_per_kwh": -5.0,
        "required_from": (now + timedelta(hours=1)).isoformat(),
        "required_to": (now + timedelta(hours=4)).isoformat()
    }, headers=headers)
    assert resp.status_code == 422

# =========================================================================
# POSTGIS SPATIAL NEARBY TESTS
# =========================================================================

async def test_postgis_nearby_listings_query(client: AsyncClient):
    # Navrangpura Ahmedabad center: (23.0350, 72.5600)
    resp = await client.get("/api/v1/listings/nearby", params={
        "latitude": 23.0350,
        "longitude": 72.5600,
        "radius_km": 15.0
    })
    assert resp.status_code == 200
    listings = resp.json()
    assert len(listings) >= 3  # Bodakdev, Prahlad Nagar, Science City are inside 15km
    
    # Verify distance_km is present and sorted ascending
    distances = [l["distance_km"] for l in listings if l["distance_km"] is not None]
    assert len(distances) >= 3
    assert distances == sorted(distances)
    for d in distances:
        assert 0.0 < d <= 15.0

async def test_postgis_nearby_excludes_far_listings(client: AsyncClient):
    # Very small radius (0.1 km) around Navrangpura where no prosumer exists
    resp = await client.get("/api/v1/listings/nearby", params={
        "latitude": 23.0350,
        "longitude": 72.5600,
        "radius_km": 0.1
    })
    assert resp.status_code == 200
    listings = resp.json()
    assert len(listings) == 0

async def test_nearby_query_invalid_coordinates(client: AsyncClient):
    # Latitude > 90
    resp = await client.get("/api/v1/listings/nearby", params={
        "latitude": 120.0,
        "longitude": 72.5600,
        "radius_km": 10.0
    })
    assert resp.status_code == 422
