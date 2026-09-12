import math
from datetime import datetime
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_Distance, ST_SetSRID, ST_MakePoint, ST_X, ST_Y

from app.models import EnergyListing, User, ReliabilityScore
from app.matching.schemas import MatchQueryRequest, MatchedSellerResult, MatchSearchResponse
from app.matching.explainability import build_match_explanation

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

async def execute_constraint_matching(
    query: MatchQueryRequest,
    db: AsyncSession
) -> MatchSearchResponse:
    # 1. Fetch active listings that meet basic status
    stmt = (
        select(
            EnergyListing,
            User.full_name.label("prosumer_name"),
            ST_Y(EnergyListing.location).label("lat"),
            ST_X(EnergyListing.location).label("lng"),
            ReliabilityScore.score.label("seller_rel_score")
        )
        .join(User, EnergyListing.prosumer_id == User.id)
        .outerjoin(ReliabilityScore, EnergyListing.prosumer_id == ReliabilityScore.user_id)
        .where(
            EnergyListing.status == "active",
            EnergyListing.energy_remaining_kwh > 0,
            EnergyListing.price_per_kwh <= query.max_price_per_kwh
        )
    )
    
    results = await db.execute(stmt)
    candidate_rows = results.all()
    
    candidates: List[MatchedSellerResult] = []
    
    for row in candidate_rows:
        listing, prosumer_name, lat, lng, rel_score = row
        seller_lat = lat if lat is not None else 23.0225
        seller_lng = lng if lng is not None else 72.5714
        seller_reliability = float(rel_score) if rel_score is not None else 100.0
        
        # Check reliability constraint
        if seller_reliability < query.min_seller_reliability:
            continue
            
        # Check geographic distance constraint
        dist_km = haversine_distance_km(query.latitude, query.longitude, seller_lat, seller_lng)
        if dist_km > query.max_radius_km:
            continue
            
        # Check substation constraint if requested
        same_substation = (listing.grid_substation_id == query.grid_substation_id)
        if query.preferred_substation_only and not same_substation:
            continue
            
        # Calculate component sub-scores (0 to 100 scale)
        # Price Score (35% weight)
        if query.max_price_per_kwh > 0:
            price_score = max(0.0, 100.0 * (1.0 - (float(listing.price_per_kwh) / query.max_price_per_kwh)))
        else:
            price_score = 100.0
            
        # Distance Score (20% weight)
        if query.max_radius_km > 0:
            dist_score = max(0.0, 100.0 * (1.0 - (dist_km / query.max_radius_km)))
        else:
            dist_score = 100.0
            
        # Reliability Score (25% weight)
        rel_subscore = seller_reliability
        
        # Grid Substation Score (10% weight)
        grid_score = 100.0 if same_substation else 40.0
        
        # Time overlap score (10% weight)
        time_score = 100.0  # Assumes active listing overlaps requested window
        
        # Weighted Composite Score
        composite_score = round(
            (0.35 * price_score) +
            (0.20 * dist_score) +
            (0.25 * rel_subscore) +
            (0.10 * grid_score) +
            (0.10 * time_score),
            2
        )
        
        explanation = build_match_explanation(
            listing_price=float(listing.price_per_kwh),
            max_price=query.max_price_per_kwh,
            distance_km=dist_km,
            max_radius_km=query.max_radius_km,
            reliability_score=seller_reliability,
            same_substation=same_substation,
            time_overlap_pct=100.0,
            composite_score=composite_score
        )
        
        candidates.append(MatchedSellerResult(
            listing_id=listing.id,
            prosumer_id=listing.prosumer_id,
            prosumer_name=prosumer_name,
            listing_title=listing.title,
            energy_available_kwh=float(listing.energy_remaining_kwh),
            price_per_kwh=float(listing.price_per_kwh),
            distance_km=dist_km,
            seller_reliability_score=seller_reliability,
            grid_substation_id=listing.grid_substation_id,
            source_type=listing.source_type,
            composite_match_score=composite_score,
            rank=1,  # Will update after sorting
            explanation=explanation,
            latitude=seller_lat,
            longitude=seller_lng
        ))
        
    # Sort descending by composite match score
    candidates.sort(key=lambda x: x.composite_match_score, reverse=True)
    
    # Assign ranks
    for idx, cand in enumerate(candidates):
        cand.rank = idx + 1
        
    return MatchSearchResponse(
        query_timestamp=datetime.utcnow(),
        total_candidates_analyzed=len(candidate_rows),
        total_matches_returned=len(candidates),
        matches=candidates
    )
