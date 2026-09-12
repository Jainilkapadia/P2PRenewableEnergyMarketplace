from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2.functions import ST_Distance, ST_SetSRID, ST_MakePoint, ST_X, ST_Y
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import EnergyListing, User, ReliabilityScore
from app.marketplace.schemas import EnergyListingCreate, EnergyListingResponse

router = APIRouter(prefix="/listings", tags=["Marketplace Listings"])

@router.post("/", response_model=EnergyListingResponse)
async def create_listing(
    listing_in: EnergyListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    geom_point = f"SRID=4326;POINT({listing_in.longitude} {listing_in.latitude})"
    
    new_listing = EnergyListing(
        prosumer_id=current_user.id,
        title=listing_in.title,
        energy_available_kwh=listing_in.energy_available_kwh,
        energy_remaining_kwh=listing_in.energy_available_kwh,
        price_per_kwh=listing_in.price_per_kwh,
        available_from=listing_in.available_from,
        available_to=listing_in.available_to,
        source_type=listing_in.source_type or "solar_rooftop",
        location=geom_point,
        grid_substation_id=listing_in.grid_substation_id or current_user.grid_substation_id or "AHMEDABAD_SUB_ZONE_1",
        status="active"
    )
    db.add(new_listing)
    await db.commit()
    await db.refresh(new_listing)

    # Fetch seller reliability score
    rel_res = await db.execute(select(ReliabilityScore).where(ReliabilityScore.user_id == current_user.id))
    rel_score = rel_res.scalar_one_or_none()

    return EnergyListingResponse(
        id=new_listing.id,
        prosumer_id=new_listing.prosumer_id,
        prosumer_name=current_user.full_name,
        title=new_listing.title,
        energy_available_kwh=float(new_listing.energy_available_kwh),
        energy_remaining_kwh=float(new_listing.energy_remaining_kwh),
        price_per_kwh=float(new_listing.price_per_kwh),
        available_from=new_listing.available_from,
        available_to=new_listing.available_to,
        source_type=new_listing.source_type,
        grid_substation_id=new_listing.grid_substation_id,
        status=new_listing.status,
        latitude=listing_in.latitude,
        longitude=listing_in.longitude,
        seller_reliability_score=float(rel_score.score) if rel_score else 100.0,
        created_at=new_listing.created_at
    )

@router.get("/", response_model=List[EnergyListingResponse])
async def list_active_listings(
    status_filter: Optional[str] = "active",
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            EnergyListing,
            User.full_name.label("prosumer_name"),
            ST_Y(EnergyListing.location).label("lat"),
            ST_X(EnergyListing.location).label("lng"),
            ReliabilityScore.score.label("rel_score")
        )
        .join(User, EnergyListing.prosumer_id == User.id)
        .outerjoin(ReliabilityScore, EnergyListing.prosumer_id == ReliabilityScore.user_id)
        .where(EnergyListing.status == status_filter if status_filter else True)
        .order_by(EnergyListing.created_at.desc())
    )
    results = await db.execute(query)
    
    output = []
    for row in results.all():
        listing, name, lat, lng, rel_score = row
        output.append(EnergyListingResponse(
            id=listing.id,
            prosumer_id=listing.prosumer_id,
            prosumer_name=name,
            title=listing.title,
            energy_available_kwh=float(listing.energy_available_kwh),
            energy_remaining_kwh=float(listing.energy_remaining_kwh),
            price_per_kwh=float(listing.price_per_kwh),
            available_from=listing.available_from,
            available_to=listing.available_to,
            source_type=listing.source_type,
            grid_substation_id=listing.grid_substation_id,
            status=listing.status,
            latitude=lat or 23.0225,
            longitude=lng or 72.5714,
            seller_reliability_score=float(rel_score) if rel_score is not None else 100.0,
            created_at=listing.created_at
        ))
    return output

@router.get("/my", response_model=List[EnergyListingResponse])
async def list_my_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            EnergyListing,
            ST_Y(EnergyListing.location).label("lat"),
            ST_X(EnergyListing.location).label("lng")
        )
        .where(EnergyListing.prosumer_id == current_user.id)
        .order_by(EnergyListing.created_at.desc())
    )
    results = await db.execute(query)
    
    output = []
    for row in results.all():
        listing, lat, lng = row
        output.append(EnergyListingResponse(
            id=listing.id,
            prosumer_id=listing.prosumer_id,
            prosumer_name=current_user.full_name,
            title=listing.title,
            energy_available_kwh=float(listing.energy_available_kwh),
            energy_remaining_kwh=float(listing.energy_remaining_kwh),
            price_per_kwh=float(listing.price_per_kwh),
            available_from=listing.available_from,
            available_to=listing.available_to,
            source_type=listing.source_type,
            grid_substation_id=listing.grid_substation_id,
            status=listing.status,
            latitude=lat or 23.0225,
            longitude=lng or 72.5714,
            created_at=listing.created_at
        ))
    return output
