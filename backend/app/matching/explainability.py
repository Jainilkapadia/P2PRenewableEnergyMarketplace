from typing import Dict, Any, List
from app.matching.schemas import MatchExplanation, MatchFactor

def build_match_explanation(
    listing_price: float,
    max_price: float,
    distance_km: float,
    max_radius_km: float,
    reliability_score: float,
    same_substation: bool,
    time_overlap_pct: float,
    composite_score: float
) -> MatchExplanation:
    factors: List[MatchFactor] = []
    
    # 1. Price Factor
    price_savings_pct = round(((max_price - listing_price) / max_price) * 100, 1) if max_price > 0 else 0
    if price_savings_pct > 0:
        factors.append(MatchFactor(
            factor="Economic Value (Price)",
            impact="POSITIVE",
            weight="35%",
            detail=f"Offered at ${listing_price:.4f}/kWh vs your budget limit of ${max_price:.4f}/kWh (Saving {price_savings_pct}%)."
        ))
    else:
        factors.append(MatchFactor(
            factor="Economic Value (Price)",
            impact="NEUTRAL",
            weight="35%",
            detail=f"Offered at exactly your upper budget threshold (${listing_price:.4f}/kWh)."
        ))

    # 2. Proximity & Physical Loss
    if distance_km < 3.0:
        factors.append(MatchFactor(
            factor="Proximity & Transmission Efficiency",
            impact="POSITIVE",
            weight="20%",
            detail=f"Located ultra-close ({distance_km:.1f} km away), drastically reducing line resistance."
        ))
    else:
        factors.append(MatchFactor(
            factor="Proximity & Distance",
            impact="NEUTRAL",
            weight="20%",
            detail=f"Located {distance_km:.1f} km away (well within your {max_radius_km:.1f} km radius)."
        ))

    # 3. Verifiable Trust / Reliability
    if reliability_score >= 95.0:
        factors.append(MatchFactor(
            factor="Verifiable Reliability History",
            impact="POSITIVE",
            weight="25%",
            detail=f"Seller maintains a verified track record of {reliability_score:.1f}% on-chain delivery score."
        ))
    elif reliability_score >= 80.0:
        factors.append(MatchFactor(
            factor="Verifiable Reliability History",
            impact="NEUTRAL",
            weight="25%",
            detail=f"Seller has a standard reliability rating of {reliability_score:.1f}%."
        ))
    else:
        factors.append(MatchFactor(
            factor="Reliability Alert",
            impact="WARNING",
            weight="25%",
            detail=f"Seller reliability is {reliability_score:.1f}%."
        ))

    # 4. Grid Substation Feeder
    if same_substation:
        factors.append(MatchFactor(
            factor="Local Grid Substation Alignment",
            impact="BONUS",
            weight="10%",
            detail="Shares your local distribution substation feeder, qualifying for peer-grid tariff reduction."
        ))
    else:
        factors.append(MatchFactor(
            factor="Cross-Substation Transmission",
            impact="NEUTRAL",
            weight="10%",
            detail="Located on adjacent distribution feeder zone."
        ))

    summary = (
        f"Ranked match ({composite_score:.1f}/100): "
        f"{'Same substation bonus, ' if same_substation else ''}"
        f"{price_savings_pct}% cost savings, located {distance_km:.1f}km away with {reliability_score:.1f}% verified reliability."
    )

    trade_off = (
        "Optimal balance between lowest cost and physical delivery reliability."
        if composite_score > 85.0 else
        "Good economical match with acceptable distance footprint."
    )

    return MatchExplanation(
        summary=summary,
        factors=factors,
        trade_off_insight=trade_off
    )
