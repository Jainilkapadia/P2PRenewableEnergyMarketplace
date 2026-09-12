from typing import Dict, Any, List
from app.matching.schemas import MatchExplanation, MatchFactor

def build_match_explanation(
    listing_price: float,
    max_price: float,
    price_score: float,
    distance_km: float,
    max_radius_km: float,
    distance_score: float,
    reliability_score: float,
    same_substation: bool,
    substation_id: str,
    overlap_duration_hours: float,
    requested_duration_hours: float,
    time_score: float,
    composite_score: float
) -> MatchExplanation:
    factors: List[MatchFactor] = []
    
    # 1. Price Benefit Factor (Weight: 35%)
    price_savings_pct = round(((max_price - listing_price) / max_price) * 100, 1) if max_price > 0 else 0.0
    if listing_price < max_price:
        price_impact = "POSITIVE"
        price_detail = (
            f"Offered at ₹{listing_price:.2f}/kWh vs your max budget of ₹{max_price:.2f}/kWh "
            f"({price_savings_pct}% lower than ceiling tariff)."
        )
    elif listing_price == max_price:
        price_impact = "NEUTRAL"
        price_detail = f"Offered at exactly your budget threshold of ₹{listing_price:.2f}/kWh."
    else:
        price_impact = "WARNING"
        price_detail = f"Offered tariff (₹{listing_price:.2f}/kWh) exceeds budget (₹{max_price:.2f}/kWh)."

    factors.append(MatchFactor(
        factor="Price Benefit",
        impact=price_impact,
        weight="35%",
        score=round(price_score, 1),
        detail=price_detail
    ))

    # 2. Proximity & Loss Reduction (Weight: 20%)
    if distance_km <= 3.0:
        dist_impact = "POSITIVE"
        dist_detail = (
            f"Ultra-close proximity at {distance_km:.1f} km away (within {max_radius_km:.1f} km radius), "
            f"minimizing distribution line loss."
        )
    elif distance_km <= max_radius_km:
        dist_impact = "NEUTRAL"
        dist_detail = (
            f"Located {distance_km:.1f} km away within your configured {max_radius_km:.1f} km distribution radius."
        )
    else:
        dist_impact = "WARNING"
        dist_detail = f"Located {distance_km:.1f} km away, which exceeds search radius of {max_radius_km:.1f} km."

    factors.append(MatchFactor(
        factor="Proximity & Loss Reduction",
        impact=dist_impact,
        weight="20%",
        score=round(distance_score, 1),
        detail=dist_detail
    ))

    # 3. Verified Seller Reliability (Weight: 25%)
    if reliability_score >= 95.0:
        rel_impact = "POSITIVE"
        rel_detail = f"Seller maintains an exceptional verified fulfillment reputation of {reliability_score:.1f}%."
    elif reliability_score >= 80.0:
        rel_impact = "NEUTRAL"
        rel_detail = f"Seller has a standard verified track record of {reliability_score:.1f}%."
    else:
        rel_impact = "WARNING"
        rel_detail = f"Seller reliability score is {reliability_score:.1f}%."

    factors.append(MatchFactor(
        factor="Verified Seller Reliability",
        impact=rel_impact,
        weight="25%",
        score=round(reliability_score, 1),
        detail=rel_detail
    ))

    # 4. Time Availability Alignment (Weight: 10%)
    time_overlap_pct = round(time_score, 1)
    if time_overlap_pct >= 99.9:
        time_impact = "POSITIVE"
        time_detail = (
            f"Full delivery window coverage: {overlap_duration_hours:.1f} hrs overlap out of "
            f"{requested_duration_hours:.1f} hrs requested (100% window match)."
        )
    elif time_overlap_pct >= 50.0:
        time_impact = "NEUTRAL"
        time_detail = (
            f"Partial delivery overlap: {overlap_duration_hours:.1f} hrs overlap out of "
            f"{requested_duration_hours:.1f} hrs requested ({time_overlap_pct}% coverage)."
        )
    else:
        time_impact = "WARNING"
        time_detail = (
            f"Limited delivery overlap: {overlap_duration_hours:.1f} hrs overlap out of "
            f"{requested_duration_hours:.1f} hrs requested ({time_overlap_pct}% coverage)."
        )

    factors.append(MatchFactor(
        factor="Time Availability Alignment",
        impact=time_impact,
        weight="10%",
        score=time_overlap_pct,
        detail=time_detail
    ))

    # 5. Grid Stability Zone (Weight: 10%)
    if same_substation:
        grid_impact = "BONUS"
        grid_detail = (
            f"Aligned on local substation {substation_id}, qualifying for zero cross-feeder transmission overhead."
        )
    else:
        grid_impact = "NEUTRAL"
        grid_detail = (
            f"Cross-feeder delivery from substation {substation_id} (standard distribution wheeling)."
        )

    factors.append(MatchFactor(
        factor="Grid Stability Zone",
        impact=grid_impact,
        weight="10%",
        score=100.0 if same_substation else 40.0,
        detail=grid_detail
    ))

    # Summary
    substation_str = "Same substation bonus, " if same_substation else ""
    summary = (
        f"Ranked match ({composite_score:.1f}/100): "
        f"{substation_str}"
        f"{price_savings_pct}% price advantage, located {distance_km:.1f} km away with {reliability_score:.1f}% verified reliability."
    )

    if composite_score >= 85.0:
        trade_off = "Optimal balance between lowest unit tariff, proximity, and verified fulfillment reliability."
    elif composite_score >= 70.0:
        trade_off = "Strong economical match with acceptable physical transmission distance."
    else:
        trade_off = "Feasible match meeting minimum constraint criteria."

    return MatchExplanation(
        summary=summary,
        factors=factors,
        trade_off_insight=trade_off
    )

