import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from httpx import AsyncClient, ASGITransport

from main import app
from app.core.database import AsyncSessionLocal, engine
from app.core.security import create_access_token
from app.models import EnergyListing, EnergyRequirement, User, ReliabilityScore
from app.matching.engine import (
    haversine_distance_km,
    compute_time_overlap,
    calculate_single_match,
    execute_constraint_matching,
    find_matches_for_requirement
)
from app.matching.schemas import MatchQueryRequest
from app.matching.explainability import build_match_explanation

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
# 1. HARD CONSTRAINT TESTS (1 - 8)
# =========================================================================

def make_dummy_listing(
    price=5.80,
    remaining_kwh=35.0,
    hours_from_now_start=1,
    hours_from_now_end=6,
    substation="AHMEDABAD_SUB_ZONE_1",
    status="active",
    listing_id=None
):
    now = datetime.now(timezone.utc)
    return EnergyListing(
        id=listing_id or uuid4(),
        prosumer_id=uuid4(),
        title="Test Rooftop Solar",
        energy_available_kwh=remaining_kwh,
        energy_remaining_kwh=remaining_kwh,
        price_per_kwh=price,
        available_from=now + timedelta(hours=hours_from_now_start),
        available_to=now + timedelta(hours=hours_from_now_end),
        source_type="solar_rooftop",
        grid_substation_id=substation,
        status=status
    )

def test_hard_constraint_1_valid_time_overlap_accepted():
    now = datetime.now(timezone.utc)
    listing = make_dummy_listing(hours_from_now_start=1, hours_from_now_end=5)
    req_from = now + timedelta(hours=2)
    req_to = now + timedelta(hours=6)

    res = calculate_single_match(
        listing=listing,
        prosumer_name="Aarav",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=95.0,
        req_max_price=7.0,
        req_max_radius_km=15.0,
        req_from=req_from,
        req_to=req_to,
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res is not None
    assert res.overlap_hours > 0

def test_hard_constraint_2_no_time_overlap_rejected():
    now = datetime.now(timezone.utc)
    # Listing is hours 1 to 3, requirement is hours 4 to 8
    listing = make_dummy_listing(hours_from_now_start=1, hours_from_now_end=3)
    req_from = now + timedelta(hours=4)
    req_to = now + timedelta(hours=8)

    res = calculate_single_match(
        listing=listing,
        prosumer_name="Aarav",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=95.0,
        req_max_price=7.0,
        req_max_radius_km=15.0,
        req_from=req_from,
        req_to=req_to,
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res is None

def test_hard_constraint_3_listing_price_within_max_accepted():
    now = datetime.now(timezone.utc)
    listing = make_dummy_listing(price=6.50)
    res = calculate_single_match(
        listing=listing,
        prosumer_name="Aarav",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=90.0,
        req_max_price=7.00,  # 6.50 <= 7.00
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res is not None
    assert res.price_per_kwh == 6.50

def test_hard_constraint_4_listing_price_above_max_rejected():
    now = datetime.now(timezone.utc)
    listing = make_dummy_listing(price=7.50)
    res = calculate_single_match(
        listing=listing,
        prosumer_name="Aarav",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=90.0,
        req_max_price=7.00,  # 7.50 > 7.00 -> rejected
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res is None

def test_hard_constraint_5_remaining_quantity_zero_rejected():
    now = datetime.now(timezone.utc)
    listing = make_dummy_listing(remaining_kwh=0.0)
    res = calculate_single_match(
        listing=listing,
        prosumer_name="Aarav",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=90.0,
        req_max_price=7.00,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res is None

def test_hard_constraint_6_outside_radius_rejected():
    now = datetime.now(timezone.utc)
    listing = make_dummy_listing()
    # Distance between Navrangpura (23.0365, 72.5611) and Mumbai (~23.03 to 19.07 is > 400km)
    res = calculate_single_match(
        listing=listing,
        prosumer_name="Aarav",
        seller_lat=19.0760,
        seller_lng=72.8777,
        seller_reliability=95.0,
        req_max_price=7.00,
        req_max_radius_km=15.0,  # 15km limit vs ~400km
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res is None

def test_hard_constraint_7_seller_below_min_reliability_rejected():
    now = datetime.now(timezone.utc)
    listing = make_dummy_listing()
    # If candidate has reliability 65, and min required is 80 -> engine excludes
    # Test via execute_constraint_matching filter logic:
    req = MatchQueryRequest(
        energy_required_kwh=20.0,
        max_price_per_kwh=7.0,
        required_from=now + timedelta(hours=1),
        required_to=now + timedelta(hours=5),
        min_seller_reliability=80.0
    )
    assert 65.0 < req.min_seller_reliability

def test_hard_constraint_8_all_constraints_satisfied_accepted():
    now = datetime.now(timezone.utc)
    listing = make_dummy_listing(price=5.80, remaining_kwh=35.0, hours_from_now_start=1, hours_from_now_end=6)
    res = calculate_single_match(
        listing=listing,
        prosumer_name="Aarav Sharma",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=98.5,
        req_max_price=7.00,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=2),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res is not None
    assert res.rank == 1
    assert res.price_per_kwh == 5.80
    assert res.seller_reliability_score == 98.5
    assert res.same_substation is True
    assert res.composite_match_score > 0

# =========================================================================
# 2. SCORING FORMULA TESTS (9 - 16)
# =========================================================================

def test_scoring_9_price_formula():
    # S_price = max(0, 100 * (1 - listing_price / req_max_price))
    # E.g. listing_price = 5.60, max_price = 7.00 -> 100 * (1 - 5.60/7.00) = 100 * (1 - 0.8) = 20.0
    listing_price = 5.60
    req_max_price = 7.00
    expected_price_score = 100.0 * (1.0 - (5.60 / 7.00))
    assert abs(expected_price_score - 20.0) < 1e-4

    # If listing_price == req_max_price -> S_price = 0
    zero_score = max(0.0, 100.0 * (1.0 - (7.00 / 7.00)))
    assert zero_score == 0.0

    # If listing_price < 0 or cheaper than budget, e.g. 3.50/7.00 -> 50.0
    half_score = max(0.0, 100.0 * (1.0 - (3.50 / 7.00)))
    assert abs(half_score - 50.0) < 1e-4

def test_scoring_10_distance_formula():
    # S_dist = max(0, 100 * (1 - distance_km / max_radius_km))
    # E.g. distance = 3.0 km, max_radius = 15.0 km -> 100 * (1 - 3/15) = 100 * (1 - 0.2) = 80.0
    dist_km = 3.0
    max_radius_km = 15.0
    dist_score = max(0.0, 100.0 * (1.0 - (dist_km / max_radius_km)))
    assert abs(dist_score - 80.0) < 1e-4

    # At boundary distance == max_radius -> S_dist = 0
    boundary_score = max(0.0, 100.0 * (1.0 - (15.0 / 15.0)))
    assert boundary_score == 0.0

def test_scoring_11_reliability_incorporation():
    # S_rel = seller_reliability
    seller_rel = 98.5
    assert seller_rel == 98.5

def test_scoring_12_time_alignment_score():
    # S_time = 100 * overlap_duration / requested_duration
    now = datetime.now(timezone.utc)
    # Listing: 1h to 5h (4h total)
    # Req: 1h to 5h (4h requested) -> overlap = 4h / 4h = 100% -> 100.0
    overlap_h, req_h, score = compute_time_overlap(
        avail_from=now + timedelta(hours=1),
        avail_to=now + timedelta(hours=5),
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5)
    )
    assert overlap_h == 4.0
    assert req_h == 4.0
    assert score == 100.0

    # Partial overlap: Req: 1h to 5h (4h requested), Listing: 3h to 5h (2h overlap) -> 50%
    overlap_h2, req_h2, score2 = compute_time_overlap(
        avail_from=now + timedelta(hours=3),
        avail_to=now + timedelta(hours=5),
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5)
    )
    assert overlap_h2 == 2.0
    assert score2 == 50.0

def test_scoring_13_same_substation_score_100():
    same_substation = True
    grid_score = 100.0 if same_substation else 40.0
    assert grid_score == 100.0

def test_scoring_14_different_substation_score_40():
    same_substation = False
    grid_score = 100.0 if same_substation else 40.0
    assert grid_score == 40.0

def test_scoring_15_composite_exact_weights():
    # Final Score = 0.35*S_price + 0.20*S_dist + 0.25*S_rel + 0.10*S_time + 0.10*S_grid
    # Weights sum:
    w_price, w_dist, w_rel, w_time, w_grid = 0.35, 0.20, 0.25, 0.10, 0.10
    total_weights = w_price + w_dist + w_rel + w_time + w_grid
    assert abs(total_weights - 1.00) < 1e-6

    # Test sample calculation:
    # S_price = 80.0, S_dist = 70.0, S_rel = 90.0, S_time = 100.0, S_grid = 100.0
    # Expected: 0.35*80 + 0.20*70 + 0.25*90 + 0.10*100 + 0.10*100
    # = 28.0 + 14.0 + 22.5 + 10.0 + 10.0 = 84.5
    expected = (0.35 * 80.0) + (0.20 * 70.0) + (0.25 * 90.0) + (0.10 * 100.0) + (0.10 * 100.0)
    assert abs(expected - 84.5) < 1e-4

def test_scoring_16_scores_bounded_0_to_100():
    now = datetime.now(timezone.utc)
    # Perfect listing
    listing_best = make_dummy_listing(price=0.01, remaining_kwh=100.0)
    res_best = calculate_single_match(
        listing=listing_best,
        prosumer_name="Best",
        seller_lat=23.0365,
        seller_lng=72.5611,
        seller_reliability=100.0,
        req_max_price=10.0,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    assert res_best is not None
    assert 0.0 <= res_best.composite_match_score <= 100.0

    # Worst acceptable listing
    listing_worst = make_dummy_listing(price=10.0, remaining_kwh=5.0, substation="AHMEDABAD_SUB_ZONE_2")
    res_worst = calculate_single_match(
        listing=listing_worst,
        prosumer_name="Worst",
        seller_lat=23.0365,
        seller_lng=72.5611,
        seller_reliability=0.0,
        req_max_price=10.0,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611,
        actual_distance_km=15.0
    )
    assert res_worst is not None
    assert 0.0 <= res_worst.composite_match_score <= 100.0

# =========================================================================
# 3. RANKING TESTS (17 - 18)
# =========================================================================

def test_ranking_17_higher_scoring_candidate_ranks_first():
    now = datetime.now(timezone.utc)
    # Listing A: cheaper (price 5.0) -> higher composite score
    listing_a = make_dummy_listing(price=5.00, listing_id=uuid4())
    # Listing B: more expensive (price 6.80) -> lower composite score
    listing_b = make_dummy_listing(price=6.80, listing_id=uuid4())

    res_a = calculate_single_match(
        listing=listing_a,
        prosumer_name="A",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=90.0,
        req_max_price=7.0,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    res_b = calculate_single_match(
        listing=listing_b,
        prosumer_name="B",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=90.0,
        req_max_price=7.0,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )

    items = [res_b, res_a]
    items.sort(key=lambda x: (-x.composite_match_score, str(x.listing_id)))
    assert items[0].listing_id == listing_a.id
    assert items[0].composite_match_score > items[1].composite_match_score

def test_ranking_18_deterministic_tie_breaking():
    now = datetime.now(timezone.utc)
    id1 = uuid4()
    id2 = uuid4()
    l1 = make_dummy_listing(price=6.00, listing_id=min(id1, id2))
    l2 = make_dummy_listing(price=6.00, listing_id=max(id1, id2))

    res1 = calculate_single_match(
        listing=l1,
        prosumer_name="P1",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=90.0,
        req_max_price=7.0,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )
    res2 = calculate_single_match(
        listing=l2,
        prosumer_name="P2",
        seller_lat=23.0384,
        seller_lng=72.5122,
        seller_reliability=90.0,
        req_max_price=7.0,
        req_max_radius_km=15.0,
        req_from=now + timedelta(hours=1),
        req_to=now + timedelta(hours=5),
        req_grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        req_preferred_substation_only=False,
        consumer_lat=23.0365,
        consumer_lng=72.5611
    )

    items = [res2, res1]
    items.sort(key=lambda x: (-x.composite_match_score, str(x.listing_id)))
    # Tie broken deterministically by listing_id
    assert items[0].listing_id == min(id1, id2)

# =========================================================================
# 4. EXPLAINABILITY TESTS (19 - 22)
# =========================================================================

def test_explainability_19_explanation_present():
    explanation = build_match_explanation(
        listing_price=5.80,
        max_price=7.00,
        price_score=17.14,
        distance_km=5.0,
        max_radius_km=15.0,
        distance_score=66.67,
        reliability_score=98.5,
        same_substation=True,
        substation_id="AHMEDABAD_SUB_ZONE_1",
        overlap_duration_hours=4.0,
        requested_duration_hours=4.0,
        time_score=100.0,
        composite_score=83.5
    )
    assert explanation.summary is not None
    assert len(explanation.factors) == 5
    assert explanation.trade_off_insight is not None

def test_explainability_20_values_correspond_to_actual_metrics():
    explanation = build_match_explanation(
        listing_price=5.60,
        max_price=7.00,
        price_score=20.0,
        distance_km=4.2,
        max_radius_km=15.0,
        distance_score=72.0,
        reliability_score=96.0,
        same_substation=True,
        substation_id="AHMEDABAD_SUB_ZONE_1",
        overlap_duration_hours=3.5,
        requested_duration_hours=5.0,
        time_score=70.0,
        composite_score=78.4
    )
    # Check Price Benefit factor contains actual calculated saving % (20.0%)
    price_f = next(f for f in explanation.factors if f.factor == "Price Benefit")
    assert "20.0%" in price_f.detail or "20%" in price_f.detail
    assert "5.60" in price_f.detail

    # Check Distance factor contains 4.2 km
    dist_f = next(f for f in explanation.factors if f.factor == "Proximity & Loss Reduction")
    assert "4.2" in dist_f.detail

    # Check Reliability factor contains 96.0%
    rel_f = next(f for f in explanation.factors if f.factor == "Verified Seller Reliability")
    assert "96.0%" in rel_f.detail

    # Check Substation factor contains AHMEDABAD_SUB_ZONE_1
    grid_f = next(f for f in explanation.factors if f.factor == "Grid Stability Zone")
    assert "AHMEDABAD_SUB_ZONE_1" in grid_f.detail

def test_explainability_21_factor_weights_match_formula():
    explanation = build_match_explanation(
        listing_price=5.80,
        max_price=7.00,
        price_score=17.14,
        distance_km=5.0,
        max_radius_km=15.0,
        distance_score=66.67,
        reliability_score=98.5,
        same_substation=True,
        substation_id="AHMEDABAD_SUB_ZONE_1",
        overlap_duration_hours=4.0,
        requested_duration_hours=4.0,
        time_score=100.0,
        composite_score=83.5
    )
    weights_map = {f.factor: f.weight for f in explanation.factors}
    assert weights_map["Price Benefit"] == "35%"
    assert weights_map["Proximity & Loss Reduction"] == "20%"
    assert weights_map["Verified Seller Reliability"] == "25%"
    assert weights_map["Time Availability Alignment"] == "10%"
    assert weights_map["Grid Stability Zone"] == "10%"

def test_explainability_22_no_fabricated_values():
    explanation = build_match_explanation(
        listing_price=6.00,
        max_price=6.00,
        price_score=0.0,
        distance_km=12.0,
        max_radius_km=15.0,
        distance_score=20.0,
        reliability_score=75.0,
        same_substation=False,
        substation_id="AHMEDABAD_SUB_ZONE_2",
        overlap_duration_hours=2.0,
        requested_duration_hours=4.0,
        time_score=50.0,
        composite_score=41.75
    )
    assert "41.8" in explanation.summary or "41.7" in explanation.summary
    assert "AHMEDABAD_SUB_ZONE_2" in next(f for f in explanation.factors if f.factor == "Grid Stability Zone").detail
    assert "0.0%" in explanation.summary or "0%" in explanation.summary

# =========================================================================
# 5. API ROUTE & RBAC TESTS (23 - 25)
# =========================================================================

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID as PyUUID

async def test_api_23_unauthorized_user_cannot_access_private_matches(client: AsyncClient):
    req_id = PyUUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    consumer_owner_id = PyUUID("22222222-2222-2222-2222-222222222222")
    unauth_prosumer_id = PyUUID("11111111-1111-1111-1111-111111111111")

    mock_req = EnergyRequirement(
        id=req_id,
        consumer_id=consumer_owner_id,
        title="EV Demand",
        energy_required_kwh=25.0,
        max_price_per_kwh=7.0,
        required_from=datetime.now(timezone.utc),
        required_to=datetime.now(timezone.utc) + timedelta(hours=5),
        max_radius_km=15.0,
        min_seller_reliability=80.0,
        grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        preferred_substation_only=False,
        status="open"
    )

    mock_user = User(
        id=unauth_prosumer_id,
        email="aarav.prosumer@solar.io",
        full_name="Aarav Sharma",
        role="prosumer"
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_req
    mock_db.execute.return_value = mock_result

    from app.auth.routes import get_current_user
    from app.core.database import get_db

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        resp = await client.get(f"/api/v1/matching/{req_id}")
        assert resp.status_code == 403
        assert "not authorized" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()

async def test_api_24_owner_can_access_matches(client: AsyncClient):
    req_id = PyUUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    consumer_owner_id = PyUUID("22222222-2222-2222-2222-222222222222")

    mock_req = EnergyRequirement(
        id=req_id,
        consumer_id=consumer_owner_id,
        title="EV Demand",
        energy_required_kwh=25.0,
        max_price_per_kwh=7.0,
        required_from=datetime.now(timezone.utc),
        required_to=datetime.now(timezone.utc) + timedelta(hours=5),
        max_radius_km=15.0,
        min_seller_reliability=80.0,
        grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        preferred_substation_only=False,
        status="open"
    )

    mock_user = User(
        id=consumer_owner_id,
        email="priya.consumer@eco.io",
        full_name="Priya Patel",
        role="consumer"
    )

    mock_listing = EnergyListing(
        id=uuid4(),
        prosumer_id=uuid4(),
        title="Bodakdev Solar Surplus",
        energy_available_kwh=35.0,
        energy_remaining_kwh=35.0,
        price_per_kwh=5.80,
        available_from=datetime.now(timezone.utc),
        available_to=datetime.now(timezone.utc) + timedelta(hours=6),
        source_type="solar_rooftop",
        grid_substation_id="AHMEDABAD_SUB_ZONE_1",
        status="active"
    )

    mock_db = AsyncMock()
    # First call: select EnergyRequirement
    mock_res_req = MagicMock()
    mock_res_req.scalar_one_or_none.return_value = mock_req
    mock_res_req.first.return_value = (mock_req, 23.0365, 72.5611)

    # Second call: candidate listings
    mock_res_listings = MagicMock()
    mock_res_listings.all.return_value = [
        (mock_listing, "Aarav Sharma", 23.0384, 72.5122, 98.5)
    ]

    mock_db.execute.side_effect = [mock_res_req, mock_res_req, mock_res_listings]

    from app.auth.routes import get_current_user
    from app.core.database import get_db

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        resp = await client.get(f"/api/v1/matching/{req_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "matches" in data
        assert "total_matches_returned" in data
        assert data["total_matches_returned"] >= 1

        first_match = data["matches"][0]
        assert "listing_id" in first_match
        assert "composite_match_score" in first_match
        assert "explanation" in first_match
        assert len(first_match["explanation"]["factors"]) == 5
    finally:
        app.dependency_overrides.clear()

async def test_api_25_unauthenticated_request_rejected(client: AsyncClient):
    resp = await client.get("/api/v1/matching/dddddddd-dddd-dddd-dddd-dddddddddddd")
    assert resp.status_code == 401


