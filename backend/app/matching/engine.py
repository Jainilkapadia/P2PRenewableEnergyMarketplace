import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, cast
from geoalchemy2.functions import ST_Distance, ST_SetSRID, ST_MakePoint, ST_X, ST_Y, ST_DWithin
from geoalchemy2 import Geography

from app.models import EnergyListing, EnergyRequirement, User, ReliabilityScore
from app.matching.schemas import (
    MatchQueryRequest,
    MatchedSellerResult,
    MatchSearchResponse,
    MatchExplanation
)
from app.matching.explainability import build_match_explanation

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two coordinate pairs in kilometers."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def compute_time_overlap(
    avail_from: datetime,
    avail_to: datetime,
    req_from: datetime,
    req_to: datetime
) -> Tuple[float, float, float]:
    """
    Computes (overlap_duration_hours, requested_duration_hours, time_overlap_score).
    Returns (0.0, requested_duration_hours, 0.0) if no overlap.
    """
    # Normalize timezones to UTC if naive
    if avail_from.tzinfo is None:
        avail_from = avail_from.replace(tzinfo=timezone.utc)
    if avail_to.tzinfo is None:
        avail_to = avail_to.replace(tzinfo=timezone.utc)
    if req_from.tzinfo is None:
        req_from = req_from.replace(tzinfo=timezone.utc)
    if req_to.tzinfo is None:
        req_to = req_to.replace(tzinfo=timezone.utc)

    overlap_start = max(avail_from, req_from)
    overlap_end = min(avail_to, req_to)
    
    overlap_seconds = max(0.0, (overlap_end - overlap_start).total_seconds())
    requested_seconds = max(1.0, (req_to - req_from).total_seconds())
    
    overlap_hours = round(overlap_seconds / 3600.0, 2)
    requested_hours = round(requested_seconds / 3600.0, 2)
    
    time_score = max(0.0, min(100.0, round((overlap_seconds / requested_seconds) * 100.0, 2)))
    return overlap_hours, requested_hours, time_score

def calculate_single_match(
    listing: EnergyListing,
    prosumer_name: str,
    seller_lat: float,
    seller_lng: float,
    seller_reliability: float,
    req_max_price: float,
    req_max_radius_km: float,
    req_from: datetime,
    req_to: datetime,
    req_grid_substation_id: str,
    req_preferred_substation_only: bool,
    consumer_lat: float,
    consumer_lng: float,
    actual_distance_km: Optional[float] = None
) -> Optional[MatchedSellerResult]:
    """
    Evaluates hard constraints, computes 5-factor weighted scores, builds explanation,
    and returns a MatchedSellerResult if eligible, or None if disqualified.
    """
    listing_price = float(listing.price_per_kwh)
    remaining_qty = float(listing.energy_remaining_kwh)
    
    # 1. Hard Constraint: Remaining Quantity > 0
    if remaining_qty <= 0 or listing.status != "active":
        return None

    # 2. Hard Constraint: Price Boundary (listing_price <= requirement_max_price)
    if listing_price > req_max_price:
        return None

    # 3. Hard Constraint: Time Overlap > 0
    overlap_hours, requested_hours, time_score = compute_time_overlap(
        listing.available_from, listing.available_to, req_from, req_to
    )
    if overlap_hours <= 0:
        return None

    # 4. Hard Constraint: Geographic Radius
    dist_km = actual_distance_km if actual_distance_km is not None else haversine_distance_km(
        consumer_lat, consumer_lng, seller_lat, seller_lng
    )
    if dist_km > req_max_radius_km:
        return None

    # 5. Hard Constraint: Minimum Seller Reliability
    if seller_reliability < 0.0 or seller_reliability > 100.0:
        seller_reliability = max(0.0, min(100.0, seller_reliability))

    # 6. Hard Constraint: Preferred Substation Only (if requested)
    same_substation = (listing.grid_substation_id == req_grid_substation_id)
    if req_preferred_substation_only and not same_substation:
        return None

    # =========================================================================
    # MULTI-OBJECTIVE SCORING (0-100 Bounded)
    # Weights: Price=0.35, Distance=0.20, Reliability=0.25, Time=0.10, Grid=0.10
    # =========================================================================
    
    # Price Score (wp = 0.35)
    if req_max_price > 0:
        price_score = max(0.0, min(100.0, 100.0 * (1.0 - (listing_price / req_max_price))))
    else:
        price_score = 100.0

    # Distance Score (wd = 0.20)
    if req_max_radius_km > 0:
        dist_score = max(0.0, min(100.0, 100.0 * (1.0 - (dist_km / req_max_radius_km))))
    else:
        dist_score = 100.0

    # Reliability Score (wr = 0.25)
    rel_score = seller_reliability

    # Time Alignment Score (wt = 0.10)
    # time_score already bounded in [0, 100]

    # Grid Substation Score (wg = 0.10)
    grid_score = 100.0 if same_substation else 40.0

    # Composite Match Score: 0.35*Price + 0.20*Dist + 0.25*Rel + 0.10*Time + 0.10*Grid
    composite_score = round(
        (0.35 * price_score) +
        (0.20 * dist_score) +
        (0.25 * rel_score) +
        (0.10 * time_score) +
        (0.10 * grid_score),
        2
    )

    # Explanation Breakdown
    explanation = build_match_explanation(
        listing_price=listing_price,
        max_price=req_max_price,
        price_score=price_score,
        distance_km=dist_km,
        max_radius_km=req_max_radius_km,
        distance_score=dist_score,
        reliability_score=seller_reliability,
        same_substation=same_substation,
        substation_id=listing.grid_substation_id,
        overlap_duration_hours=overlap_hours,
        requested_duration_hours=requested_hours,
        time_score=time_score,
        composite_score=composite_score
    )

    return MatchedSellerResult(
        listing_id=listing.id,
        prosumer_id=listing.prosumer_id,
        prosumer_name=prosumer_name,
        listing_title=listing.title,
        energy_available_kwh=remaining_qty,
        price_per_kwh=listing_price,
        distance_km=dist_km,
        seller_reliability_score=seller_reliability,
        grid_substation_id=listing.grid_substation_id,
        same_substation=same_substation,
        available_from=listing.available_from,
        available_to=listing.available_to,
        overlap_hours=overlap_hours,
        source_type=listing.source_type or "solar_rooftop",
        composite_match_score=composite_score,
        rank=1,  # Assigned after sorting
        explanation=explanation,
        latitude=seller_lat,
        longitude=seller_lng
    )

async def execute_constraint_matching(
    query: MatchQueryRequest,
    db: AsyncSession
) -> MatchSearchResponse:
    """
    Ad-hoc matching based on a custom MatchQueryRequest.
    """
    req_point_wkt = f"SRID=4326;POINT({query.longitude} {query.latitude})"
    radius_meters = (query.max_radius_km or 15.0) * 1000.0

    # Query listings meeting database-side hard constraints
    stmt = (
        select(
            EnergyListing,
            User.full_name.label("prosumer_name"),
            ST_Y(EnergyListing.location).label("lat"),
            ST_X(EnergyListing.location).label("lng"),
            func.coalesce(ReliabilityScore.score, 100.0).label("seller_rel_score")
        )
        .join(User, EnergyListing.prosumer_id == User.id)
        .outerjoin(ReliabilityScore, EnergyListing.prosumer_id == ReliabilityScore.user_id)
        .where(
            EnergyListing.status == "active",
            EnergyListing.energy_remaining_kwh > 0,
            EnergyListing.price_per_kwh <= query.max_price_per_kwh,
            EnergyListing.available_from < query.required_to,
            EnergyListing.available_to > query.required_from
        )
    )

    results = await db.execute(stmt)
    candidate_rows = results.all()

    candidates: List[MatchedSellerResult] = []
    min_reliability = query.min_seller_reliability if query.min_seller_reliability is not None else 70.0

    for row in candidate_rows:
        listing, prosumer_name, lat, lng, rel_score = row
        seller_lat = float(lat) if lat is not None else 23.0384
        seller_lng = float(lng) if lng is not None else 72.5122
        seller_rel = float(rel_score) if rel_score is not None else 100.0

        # Hard Constraint: Min Seller Reliability
        if seller_rel < min_reliability:
            continue

        matched = calculate_single_match(
            listing=listing,
            prosumer_name=prosumer_name or "Prosumer",
            seller_lat=seller_lat,
            seller_lng=seller_lng,
            seller_reliability=seller_rel,
            req_max_price=query.max_price_per_kwh,
            req_max_radius_km=query.max_radius_km or 15.0,
            req_from=query.required_from,
            req_to=query.required_to,
            req_grid_substation_id=query.grid_substation_id or "AHMEDABAD_SUB_ZONE_1",
            req_preferred_substation_only=query.preferred_substation_only or False,
            consumer_lat=query.latitude,
            consumer_lng=query.longitude
        )
        if matched:
            candidates.append(matched)

    # Sort descending by composite match score, then stable secondary key (listing_id)
    candidates.sort(key=lambda x: (-x.composite_match_score, str(x.listing_id)))

    # Assign ranks
    for idx, cand in enumerate(candidates):
        cand.rank = idx + 1

    return MatchSearchResponse(
        requirement_id=None,
        query_timestamp=datetime.now(timezone.utc),
        total_candidates_analyzed=len(candidate_rows),
        total_matches_returned=len(candidates),
        matches=candidates
    )

async def find_matches_for_requirement(
    requirement_id: UUID,
    db: AsyncSession
) -> MatchSearchResponse:
    """
    Executes matching against an existing EnergyRequirement record.
    """
    # Fetch requirement with spatial coordinates
    req_stmt = (
        select(
            EnergyRequirement,
            ST_Y(EnergyRequirement.location).label("lat"),
            ST_X(EnergyRequirement.location).label("lng")
        )
        .where(EnergyRequirement.id == requirement_id)
    )
    req_res = await db.execute(req_stmt)
    req_row = req_res.first()

    if not req_row:
        raise ValueError(f"Requirement with ID {requirement_id} not found.")

    requirement, req_lat, req_lng = req_row
    consumer_lat = float(req_lat) if req_lat is not None else 23.0365
    consumer_lng = float(req_lng) if req_lng is not None else 72.5611
    max_radius_km = float(requirement.max_radius_km) if requirement.max_radius_km is not None else 15.0
    min_reliability = float(requirement.min_seller_reliability) if requirement.min_seller_reliability is not None else 70.0
    max_price = float(requirement.max_price_per_kwh)

    # Database-side hard filtering
    stmt = (
        select(
            EnergyListing,
            User.full_name.label("prosumer_name"),
            ST_Y(EnergyListing.location).label("lat"),
            ST_X(EnergyListing.location).label("lng"),
            func.coalesce(ReliabilityScore.score, 100.0).label("seller_rel_score")
        )
        .join(User, EnergyListing.prosumer_id == User.id)
        .outerjoin(ReliabilityScore, EnergyListing.prosumer_id == ReliabilityScore.user_id)
        .where(
            EnergyListing.status == "active",
            EnergyListing.energy_remaining_kwh > 0,
            EnergyListing.price_per_kwh <= max_price,
            EnergyListing.available_from < requirement.required_to,
            EnergyListing.available_to > requirement.required_from
        )
    )

    results = await db.execute(stmt)
    candidate_rows = results.all()

    candidates: List[MatchedSellerResult] = []

    for row in candidate_rows:
        listing, prosumer_name, lat, lng, rel_score = row
        seller_lat = float(lat) if lat is not None else 23.0384
        seller_lng = float(lng) if lng is not None else 72.5122
        seller_rel = float(rel_score) if rel_score is not None else 100.0

        # Hard Constraint: Min Seller Reliability
        if seller_rel < min_reliability:
            continue

        matched = calculate_single_match(
            listing=listing,
            prosumer_name=prosumer_name or "Prosumer",
            seller_lat=seller_lat,
            seller_lng=seller_lng,
            seller_reliability=seller_rel,
            req_max_price=max_price,
            req_max_radius_km=max_radius_km,
            req_from=requirement.required_from,
            req_to=requirement.required_to,
            req_grid_substation_id=requirement.grid_substation_id or "AHMEDABAD_SUB_ZONE_1",
            req_preferred_substation_only=requirement.preferred_substation_only or False,
            consumer_lat=consumer_lat,
            consumer_lng=consumer_lng
        )
        if matched:
            candidates.append(matched)

    # Sort descending by composite match score, then stable secondary key (listing_id)
    candidates.sort(key=lambda x: (-x.composite_match_score, str(x.listing_id)))

    # Assign ranks
    for idx, cand in enumerate(candidates):
        cand.rank = idx + 1

    return MatchSearchResponse(
        requirement_id=requirement_id,
        query_timestamp=datetime.now(timezone.utc),
        total_candidates_analyzed=len(candidate_rows),
        total_matches_returned=len(candidates),
        matches=candidates
    )

