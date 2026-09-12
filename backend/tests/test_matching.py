import pytest
from app.matching.engine import haversine_distance_km
from app.matching.explainability import build_match_explanation

def test_haversine_distance():
    # Ahmedabad Navrangpura to Bodakdev (~5.0 km)
    dist = haversine_distance_km(23.0365, 72.5611, 23.0384, 72.5122)
    assert 4.0 < dist < 6.0

def test_match_explanation_generation():
    explanation = build_match_explanation(
        listing_price=5.80,
        max_price=7.00,
        distance_km=5.0,
        max_radius_km=15.0,
        reliability_score=98.5,
        same_substation=True,
        time_overlap_pct=100.0,
        composite_score=92.5
    )
    assert len(explanation.factors) >= 4
    assert any("Price" in f.factor for f in explanation.factors)
    assert any("Substation" in f.factor for f in explanation.factors)
    assert "92.5" in explanation.summary
