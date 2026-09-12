import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from main import app

@pytest_asyncio.fixture(scope="function")
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# =========================================================================
# 1. 24-HOUR SOLAR GENERATION FORECAST TESTS
# =========================================================================

@pytest.mark.asyncio
async def test_solar_forecast_default_structure(client: AsyncClient):
    """Verify default solar forecast returns exactly 24 hourly points with valid schema."""
    resp = await client.get("/api/v1/analytics/forecast/solar")
    assert resp.status_code == 200
    points = resp.json()
    assert isinstance(points, list)
    assert len(points) == 24

    for i, pt in enumerate(points):
        assert pt["hour"] == i
        assert pt["time_label"] == f"{i:02d}:00"
        assert pt["expected_generation_kwh"] >= 0.0
        assert pt["confidence_interval_low"] >= 0.0
        assert pt["confidence_interval_high"] >= pt["expected_generation_kwh"]
        assert pt["confidence_interval_low"] <= pt["expected_generation_kwh"]
        assert pt["optimal_selling_price"] > 0.0
        assert isinstance(pt["is_optimal_window"], bool)


@pytest.mark.asyncio
async def test_solar_forecast_diurnal_curve_and_night_zero(client: AsyncClient):
    """Verify nighttime generation is zero and midday generation peaks."""
    resp = await client.get("/api/v1/analytics/forecast/solar")
    assert resp.status_code == 200
    points = resp.json()

    # Night hours: 0-5 and 20-23 should have zero generation
    for h in [0, 1, 2, 3, 4, 5, 20, 21, 22, 23]:
        assert points[h]["expected_generation_kwh"] == 0.0
        assert points[h]["confidence_interval_low"] == 0.0
        assert points[h]["confidence_interval_high"] == 0.0
        assert points[h]["is_optimal_window"] is False

    # Daylight peak hours: 11-14 should have high generation and be flagged as optimal window
    noon_gen = points[12]["expected_generation_kwh"]
    assert noon_gen > 0.0

    for h in [11, 12, 13, 14]:
        assert points[h]["expected_generation_kwh"] > 0.0
        assert points[h]["is_optimal_window"] is True

    # Midday generation should be higher than early morning (e.g. 7am)
    morning_gen = points[7]["expected_generation_kwh"]
    assert noon_gen > morning_gen


@pytest.mark.asyncio
async def test_solar_forecast_inr_tariffs(client: AsyncClient):
    """Verify tariff pricing is INR-denominated and follows merit order clearing."""
    resp = await client.get("/api/v1/analytics/forecast/solar")
    assert resp.status_code == 200
    points = resp.json()

    # Daytime peak abundance should yield lower unit prices (around ₹5.40/kWh)
    noon_price = points[12]["optimal_selling_price"]
    assert 5.00 <= noon_price <= 6.20

    # Shoulder or night prices should be higher (₹6.50 - ₹7.20/kWh) but below grid benchmark ₹7.60
    night_price = points[2]["optimal_selling_price"]
    assert noon_price < night_price
    assert night_price <= 7.60


@pytest.mark.asyncio
async def test_solar_forecast_capacity_scaling(client: AsyncClient):
    """Verify capacity scaling invariant: higher capacity produces proportionally higher output."""
    resp_5kw = await client.get("/api/v1/analytics/forecast/solar?capacity_kw=5.0")
    resp_10kw = await client.get("/api/v1/analytics/forecast/solar?capacity_kw=10.0")

    assert resp_5kw.status_code == 200
    assert resp_10kw.status_code == 200

    points_5kw = resp_5kw.json()
    points_10kw = resp_10kw.json()

    total_5kw = sum(pt["expected_generation_kwh"] for pt in points_5kw)
    total_10kw = sum(pt["expected_generation_kwh"] for pt in points_10kw)

    assert total_10kw > total_5kw
    # 10 kW should produce approximately double the output of 5 kW
    ratio = total_10kw / total_5kw
    assert 1.90 <= ratio <= 2.10


@pytest.mark.asyncio
async def test_solar_forecast_capacity_validation(client: AsyncClient):
    """Verify capacity bounds validation (3.0 kW to 15.0 kW)."""
    # Lower bound violations
    resp_too_low = await client.get("/api/v1/analytics/forecast/solar?capacity_kw=2.9")
    assert resp_too_low.status_code == 422
    assert "between 3.0 kW and 15.0 kW" in resp_too_low.json()["detail"]

    # Upper bound violations
    resp_too_high = await client.get("/api/v1/analytics/forecast/solar?capacity_kw=15.1")
    assert resp_too_high.status_code == 422
    assert "between 3.0 kW and 15.0 kW" in resp_too_high.json()["detail"]

    # Exact boundary values must succeed
    resp_min = await client.get("/api/v1/analytics/forecast/solar?capacity_kw=3.0")
    assert resp_min.status_code == 200

    resp_max = await client.get("/api/v1/analytics/forecast/solar?capacity_kw=15.0")
    assert resp_max.status_code == 200


@pytest.mark.asyncio
async def test_solar_forecast_legacy_alias(client: AsyncClient):
    """Verify system_capacity_kw parameter works as backward-compatible alias."""
    resp = await client.get("/api/v1/analytics/forecast/solar?system_capacity_kw=8.0")
    assert resp.status_code == 200
    points = resp.json()
    noon_gen = points[12]["expected_generation_kwh"]
    assert noon_gen > 5.0  # scaled to 8 kW system


# =========================================================================
# 2. MARKET OVERVIEW & AGGREGATE ANALYTICS TESTS
# =========================================================================

@pytest.mark.asyncio
async def test_market_overview_structure_and_types(client: AsyncClient):
    """Verify GET /analytics/overview response format and invariant types."""
    resp = await client.get("/api/v1/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()

    required_fields = [
        "total_volume_traded_kwh",
        "total_value_transacted_inr",
        "average_unit_price",
        "total_verified_trades",
        "co2_offset_kg",
        "active_prosumers_count",
        "grid_tariff_benchmark",
        "total_value_transacted_usd"
    ]
    for field in required_fields:
        assert field in data, f"Missing expected field: {field}"

    assert data["total_volume_traded_kwh"] >= 0.0
    assert data["total_value_transacted_inr"] >= 0.0
    assert data["average_unit_price"] >= 0.0
    assert data["total_verified_trades"] >= 0
    assert data["active_prosumers_count"] >= 0
    assert data["grid_tariff_benchmark"] == 7.60


@pytest.mark.asyncio
async def test_market_overview_carbon_offset_invariant(client: AsyncClient):
    """Verify CO2 offset adheres to 0.42 kg CO2 / kWh renewable generation standard."""
    resp = await client.get("/api/v1/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()

    volume_kwh = data["total_volume_traded_kwh"]
    expected_co2 = round(volume_kwh * 0.42, 2)
    assert abs(data["co2_offset_kg"] - expected_co2) < 0.05


@pytest.mark.asyncio
async def test_analytics_privacy_and_security(client: AsyncClient):
    """Verify advisory analytics endpoints do not leak sensitive credentials or private user data."""
    overview_resp = await client.get("/api/v1/analytics/overview")
    forecast_resp = await client.get("/api/v1/analytics/forecast/solar")

    overview_text = overview_resp.text.lower()
    forecast_text = forecast_resp.text.lower()

    sensitive_keywords = ["private_key", "password", "secret", "seed_phrase", "wallet_key", "bearer"]
    for kw in sensitive_keywords:
        assert kw not in overview_text, f"Sensitive term '{kw}' found in overview response!"
        assert kw not in forecast_text, f"Sensitive term '{kw}' found in forecast response!"
