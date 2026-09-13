from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast
from geoalchemy2 import Geography
from geoalchemy2.functions import ST_X, ST_Y
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import EnergyListing, User, ReliabilityScore
from app.marketplace.schemas import EnergyListingCreate, EnergyListingUpdate, EnergyListingResponse
from app.notifications.routes import create_user_notification

router = APIRouter(prefix="/listings", tags=["Marketplace Listings"])

@router.post("/", response_model=EnergyListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    listing_in: EnergyListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Role check: Only Prosumer or Dual can create energy listings (Admin forbidden)
    user_role = (current_user.role or "").lower()
    if user_role not in ["prosumer", "dual"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only prosumers or dual accounts can create energy listings."
        )

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
    await db.flush()

    # In-app notification for listing creator
    await create_user_notification(
        db=db,
        user_id=current_user.id,
        title="Energy Listing Published",
        message=f"Your listing for {float(new_listing.energy_available_kwh):.1f} kWh at ₹{float(new_listing.price_per_kwh):.2f}/kWh is now active on the Ahmedabad grid.",
        notif_type="listing_created",
        reference_id=new_listing.id
    )

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
async def list_listings(
    status_filter: Optional[str] = "active",
    source_type: Optional[str] = None,
    grid_substation_id: Optional[str] = None,
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
    )

    if status_filter:
        query = query.where(EnergyListing.status == status_filter)
    if source_type:
        query = query.where(EnergyListing.source_type == source_type)
    if grid_substation_id:
        query = query.where(EnergyListing.grid_substation_id == grid_substation_id)

    query = query.order_by(EnergyListing.created_at.desc())
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
            latitude=lat if lat is not None else 23.0384,
            longitude=lng if lng is not None else 72.5122,
            seller_reliability_score=float(rel_score) if rel_score is not None else 100.0,
            created_at=listing.created_at
        ))
    return output

@router.get("/nearby", response_model=List[EnergyListingResponse])
async def list_nearby_listings(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Consumer latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Consumer longitude"),
    radius_km: float = Query(15.0, gt=0, le=100.0, description="Search radius in kilometers"),
    status_filter: Optional[str] = "active",
    db: AsyncSession = Depends(get_db)
):
    """
    Find listings within a geographic radius using PostGIS spatial operations.
    Returns distance in kilometers sorted by proximity.
    """
    radius_meters = float(radius_km) * 1000.0
    ref_point_geom = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)

    loc_geog = cast(EnergyListing.location, Geography(srid=4326))
    ref_geog = cast(ref_point_geom, Geography(srid=4326))

    # PostGIS distance expression in kilometers
    distance_km_expr = func.ST_Distance(loc_geog, ref_geog) / 1000.0

    query = (
        select(
            EnergyListing,
            User.full_name.label("prosumer_name"),
            ST_Y(EnergyListing.location).label("lat"),
            ST_X(EnergyListing.location).label("lng"),
            ReliabilityScore.score.label("rel_score"),
            distance_km_expr.label("distance_km")
        )
        .join(User, EnergyListing.prosumer_id == User.id)
        .outerjoin(ReliabilityScore, EnergyListing.prosumer_id == ReliabilityScore.user_id)
        .where(
            func.ST_DWithin(loc_geog, ref_geog, radius_meters)
        )
    )

    if status_filter:
        query = query.where(EnergyListing.status == status_filter)

    query = query.order_by(distance_km_expr.asc())
    results = await db.execute(query)

    output = []
    for row in results.all():
        listing, name, lat, lng, rel_score, dist_km = row
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
            latitude=lat if lat is not None else latitude,
            longitude=lng if lng is not None else longitude,
            distance_km=round(float(dist_km), 2) if dist_km is not None else None,
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
            ST_X(EnergyListing.location).label("lng"),
            ReliabilityScore.score.label("rel_score")
        )
        .outerjoin(ReliabilityScore, EnergyListing.prosumer_id == ReliabilityScore.user_id)
        .where(EnergyListing.prosumer_id == current_user.id)
        .order_by(EnergyListing.created_at.desc())
    )
    results = await db.execute(query)
    
    output = []
    for row in results.all():
        listing, lat, lng, rel_score = row
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
            latitude=lat if lat is not None else 23.0384,
            longitude=lng if lng is not None else 72.5122,
            seller_reliability_score=float(rel_score) if rel_score is not None else 100.0,
            created_at=listing.created_at
        ))
    return output

@router.get("/{id}", response_model=EnergyListingResponse)
async def get_listing_by_id(
    id: UUID,
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
        .where(EnergyListing.id == id)
    )
    res = await db.execute(query)
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Energy listing with ID {id} not found."
        )

    listing, name, lat, lng, rel_score = row
    return EnergyListingResponse(
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
        latitude=lat if lat is not None else 23.0384,
        longitude=lng if lng is not None else 72.5122,
        seller_reliability_score=float(rel_score) if rel_score is not None else 100.0,
        created_at=listing.created_at
    )

@router.put("/{id}", response_model=EnergyListingResponse)
async def update_listing(
    id: UUID,
    listing_update: EnergyListingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(EnergyListing).where(EnergyListing.id == id))
    listing = res.scalar_one_or_none()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Energy listing with ID {id} not found."
        )

    # Ownership check: Prosumer can only update their own listings; Admin can update any
    user_role = (current_user.role or "").lower()
    if listing.prosumer_id != current_user.id and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this energy listing."
        )

    if listing_update.title is not None:
        listing.title = listing_update.title
    if listing_update.energy_available_kwh is not None:
        listing.energy_available_kwh = listing_update.energy_available_kwh
    if listing_update.energy_remaining_kwh is not None:
        listing.energy_remaining_kwh = listing_update.energy_remaining_kwh
    if listing_update.price_per_kwh is not None:
        listing.price_per_kwh = listing_update.price_per_kwh
    if listing_update.available_from is not None:
        listing.available_from = listing_update.available_from
    if listing_update.available_to is not None:
        listing.available_to = listing_update.available_to
    if listing_update.source_type is not None:
        listing.source_type = listing_update.source_type
    if listing_update.grid_substation_id is not None:
        listing.grid_substation_id = listing_update.grid_substation_id
    if listing_update.status is not None:
        listing.status = listing_update.status

    await db.commit()
    await db.refresh(listing)

    # Fetch lat, lng and reliability
    coords_res = await db.execute(
        select(ST_Y(listing.location), ST_X(listing.location))
    )
    lat, lng = coords_res.first()

    rel_res = await db.execute(select(ReliabilityScore).where(ReliabilityScore.user_id == listing.prosumer_id))
    rel_score = rel_res.scalar_one_or_none()

    return EnergyListingResponse(
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
        latitude=lat if lat is not None else 23.0384,
        longitude=lng if lng is not None else 72.5122,
        seller_reliability_score=float(rel_score.score) if rel_score else 100.0,
        created_at=listing.created_at
    )

@router.delete("/{id}", response_model=dict)
async def delete_or_cancel_listing(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(EnergyListing).where(EnergyListing.id == id))
    listing = res.scalar_one_or_none()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Energy listing with ID {id} not found."
        )

    user_role = (current_user.role or "").lower()
    if listing.prosumer_id != current_user.id and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this energy listing."
        )

    listing.status = "cancelled"
    await db.commit()

    return {"message": "Energy listing cancelled successfully.", "id": str(id), "status": "cancelled"}
