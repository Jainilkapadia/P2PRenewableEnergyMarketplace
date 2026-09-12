import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text
from geoalchemy2.functions import ST_AsText, ST_X, ST_Y
from datetime import datetime, timezone, timedelta

from main import app
from app.core.database import AsyncSessionLocal, engine
from app.models import User, Wallet, EnergyListing, EnergyRequirement, ReliabilityScore
from app.matching.schemas import MatchQueryRequest
from app.matching.engine import execute_constraint_matching

@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Yield a database session per test and clean up connection."""
    async with AsyncSessionLocal() as session:
        yield session
    # Dispose connection pool to ensure clean event loop boundary
    await engine.dispose()

async def test_database_connection_and_postgis(db_session):
    """Verify PostgreSQL connectivity and PostGIS extension."""
    result = await db_session.execute(text("SELECT PostGIS_Version(), current_database()"))
    row = result.fetchone()
    assert row is not None
    assert "3.4" in row[0]
    assert row[1] == "p2p_energy_db"

async def test_seeded_users_and_wallets(db_session):
    """Verify seeded users, Ahmedabad substations, and INR wallets."""
    # Check users
    users_res = await db_session.execute(select(User).order_by(User.email))
    users = users_res.scalars().all()
    assert len(users) >= 5
    
    emails = [u.email for u in users]
    assert "aarav.prosumer@solar.io" in emails
    assert "priya.consumer@eco.io" in emails
    assert "admin@p2penergy.gov.in" in emails
    
    # Check wallets
    wallets_res = await db_session.execute(select(Wallet))
    wallets = wallets_res.scalars().all()
    assert len(wallets) >= 5
    for w in wallets:
        assert w.currency == "INR"
        assert float(w.available_balance) > 0

async def test_seeded_listings_geometry_and_substations(db_session):
    """Verify seeded Ahmedabad listings and spatial point geometry."""
    query = select(
        EnergyListing,
        ST_AsText(EnergyListing.location).label("wkt"),
        ST_Y(EnergyListing.location).label("lat"),
        ST_X(EnergyListing.location).label("lng")
    ).where(EnergyListing.status == "active")
    
    res = await db_session.execute(query)
    rows = res.all()
    assert len(rows) >= 3
    
    for listing, wkt, lat, lng in rows:
        assert "POINT" in wkt
        assert 23.0 <= lat <= 23.15  # Ahmedabad latitude range
        assert 72.45 <= lng <= 72.65  # Ahmedabad longitude range
        assert float(listing.price_per_kwh) > 0

async def test_matching_engine_with_real_db_data(db_session):
    """Verify matching engine queries the database and ranks Ahmedabad sellers."""
    now = datetime.now(timezone.utc)
    query = MatchQueryRequest(
        energy_required_kwh=25.0,
        max_price_per_kwh=7.0,
        required_from=now,
        required_to=now + timedelta(hours=6),
        latitude=23.0365,
        longitude=72.5611,
        max_radius_km=15.0,
        min_seller_reliability=70.0,
        grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        preferred_substation_only=False
    )
    
    response = await execute_constraint_matching(query, db_session)
    assert response.total_candidates_analyzed >= 3
    assert response.total_matches_returned >= 2
    assert len(response.matches) > 0
    
    top_match = response.matches[0]
    assert top_match.rank == 1
    assert top_match.distance_km <= 15.0
    assert top_match.price_per_kwh <= 7.0
    assert top_match.composite_match_score > 0
    assert len(top_match.explanation.factors) >= 4

async def test_fastapi_endpoints():
    """Verify FastAPI root, health, marketplace listings, and match endpoints over HTTP."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Health check
        health_resp = await ac.get("/health")
        assert health_resp.status_code == 200
        assert health_resp.json() == {"status": "healthy"}
        
        # 2. Root service info
        root_resp = await ac.get("/")
        assert root_resp.status_code == 200
        assert root_resp.json()["status"] == "online"
        
        # 3. Marketplace active listings (registered at /api/v1/listings/)
        listings_resp = await ac.get("/api/v1/listings/")
        assert listings_resp.status_code == 200
        listings = listings_resp.json()
        assert len(listings) >= 3
        first_listing = listings[0]
        assert "price_per_kwh" in first_listing
        assert "latitude" in first_listing
        assert "longitude" in first_listing
        assert "prosumer_name" in first_listing
        assert "seller_reliability_score" in first_listing
        
        # 4. Matching search endpoint
        match_payload = {
            "energy_required_kwh": 25.0,
            "max_price_per_kwh": 7.0,
            "required_from": datetime.now(timezone.utc).isoformat(),
            "required_to": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
            "latitude": 23.0365,
            "longitude": 72.5611,
            "max_radius_km": 15.0,
            "min_seller_reliability": 70.0,
            "grid_substation_id": "AHMEDABAD_SUB_ZONE_1",
            "preferred_substation_only": False
        }
        match_resp = await ac.post("/api/v1/matching/find-matches", json=match_payload)
        assert match_resp.status_code == 200
        match_data = match_resp.json()
        assert match_data["total_matches_returned"] >= 2
        assert len(match_data["matches"]) >= 2

    await engine.dispose()
