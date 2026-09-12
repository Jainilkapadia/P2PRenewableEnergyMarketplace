from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2.functions import ST_X, ST_Y
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import EnergyRequirement, User
from app.requirements.schemas import (
    EnergyRequirementCreate,
    EnergyRequirementUpdate,
    EnergyRequirementResponse
)

router = APIRouter(prefix="/requirements", tags=["Consumer Energy Requirements"])

@router.post("/", response_model=EnergyRequirementResponse, status_code=status.HTTP_201_CREATED)
async def create_requirement(
    req_in: EnergyRequirementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Role check: Only Consumer or Dual can create energy requirements (Admin forbidden)
    user_role = (current_user.role or "").lower()
    if user_role not in ["consumer", "dual"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only consumers or dual accounts can create energy requirements."
        )

    lat = req_in.latitude if req_in.latitude is not None else 23.0300
    lng = req_in.longitude if req_in.longitude is not None else 72.5350
    geom_point = f"SRID=4326;POINT({lng} {lat})"

    new_req = EnergyRequirement(
        consumer_id=current_user.id,
        title=req_in.title,
        energy_required_kwh=req_in.energy_required_kwh,
        max_price_per_kwh=req_in.max_price_per_kwh,
        required_from=req_in.required_from,
        required_to=req_in.required_to,
        max_radius_km=req_in.max_radius_km if req_in.max_radius_km is not None else 15.0,
        min_seller_reliability=req_in.min_seller_reliability if req_in.min_seller_reliability is not None else 70.0,
        location=geom_point,
        grid_substation_id=req_in.grid_substation_id or current_user.grid_substation_id or "AHMEDABAD_SUB_ZONE_1",
        preferred_substation_only=req_in.preferred_substation_only if req_in.preferred_substation_only is not None else False,
        status="open"
    )
    db.add(new_req)
    await db.commit()
    await db.refresh(new_req)

    return EnergyRequirementResponse(
        id=new_req.id,
        consumer_id=new_req.consumer_id,
        consumer_name=current_user.full_name,
        title=new_req.title,
        energy_required_kwh=float(new_req.energy_required_kwh),
        max_price_per_kwh=float(new_req.max_price_per_kwh),
        required_from=new_req.required_from,
        required_to=new_req.required_to,
        max_radius_km=float(new_req.max_radius_km),
        min_seller_reliability=float(new_req.min_seller_reliability),
        grid_substation_id=new_req.grid_substation_id,
        preferred_substation_only=new_req.preferred_substation_only,
        status=new_req.status,
        latitude=lat,
        longitude=lng,
        created_at=new_req.created_at
    )

@router.get("/", response_model=List[EnergyRequirementResponse])
async def list_requirements(
    status_filter: Optional[str] = "open",
    grid_substation_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            EnergyRequirement,
            User.full_name.label("consumer_name"),
            ST_Y(EnergyRequirement.location).label("lat"),
            ST_X(EnergyRequirement.location).label("lng")
        )
        .join(User, EnergyRequirement.consumer_id == User.id)
    )

    if status_filter:
        query = query.where(EnergyRequirement.status == status_filter)
    if grid_substation_id:
        query = query.where(EnergyRequirement.grid_substation_id == grid_substation_id)

    query = query.order_by(EnergyRequirement.created_at.desc())
    results = await db.execute(query)
    
    output = []
    for row in results.all():
        req, name, lat, lng = row
        output.append(EnergyRequirementResponse(
            id=req.id,
            consumer_id=req.consumer_id,
            consumer_name=name,
            title=req.title,
            energy_required_kwh=float(req.energy_required_kwh),
            max_price_per_kwh=float(req.max_price_per_kwh),
            required_from=req.required_from,
            required_to=req.required_to,
            max_radius_km=float(req.max_radius_km),
            min_seller_reliability=float(req.min_seller_reliability),
            grid_substation_id=req.grid_substation_id,
            preferred_substation_only=req.preferred_substation_only,
            status=req.status,
            latitude=lat if lat is not None else 23.0300,
            longitude=lng if lng is not None else 72.5350,
            created_at=req.created_at
        ))
    return output

@router.get("/my", response_model=List[EnergyRequirementResponse])
async def list_my_requirements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            EnergyRequirement,
            ST_Y(EnergyRequirement.location).label("lat"),
            ST_X(EnergyRequirement.location).label("lng")
        )
        .where(EnergyRequirement.consumer_id == current_user.id)
        .order_by(EnergyRequirement.created_at.desc())
    )
    results = await db.execute(query)
    
    output = []
    for row in results.all():
        req, lat, lng = row
        output.append(EnergyRequirementResponse(
            id=req.id,
            consumer_id=req.consumer_id,
            consumer_name=current_user.full_name,
            title=req.title,
            energy_required_kwh=float(req.energy_required_kwh),
            max_price_per_kwh=float(req.max_price_per_kwh),
            required_from=req.required_from,
            required_to=req.required_to,
            max_radius_km=float(req.max_radius_km),
            min_seller_reliability=float(req.min_seller_reliability),
            grid_substation_id=req.grid_substation_id,
            preferred_substation_only=req.preferred_substation_only,
            status=req.status,
            latitude=lat if lat is not None else 23.0300,
            longitude=lng if lng is not None else 72.5350,
            created_at=req.created_at
        ))
    return output

@router.get("/{id}", response_model=EnergyRequirementResponse)
async def get_requirement_by_id(
    id: UUID,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            EnergyRequirement,
            User.full_name.label("consumer_name"),
            ST_Y(EnergyRequirement.location).label("lat"),
            ST_X(EnergyRequirement.location).label("lng")
        )
        .join(User, EnergyRequirement.consumer_id == User.id)
        .where(EnergyRequirement.id == id)
    )
    res = await db.execute(query)
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Energy requirement with ID {id} not found."
        )

    req, name, lat, lng = row
    return EnergyRequirementResponse(
        id=req.id,
        consumer_id=req.consumer_id,
        consumer_name=name,
        title=req.title,
        energy_required_kwh=float(req.energy_required_kwh),
        max_price_per_kwh=float(req.max_price_per_kwh),
        required_from=req.required_from,
        required_to=req.required_to,
        max_radius_km=float(req.max_radius_km),
        min_seller_reliability=float(req.min_seller_reliability),
        grid_substation_id=req.grid_substation_id,
        preferred_substation_only=req.preferred_substation_only,
        status=req.status,
        latitude=lat if lat is not None else 23.0300,
        longitude=lng if lng is not None else 72.5350,
        created_at=req.created_at
    )

@router.put("/{id}", response_model=EnergyRequirementResponse)
async def update_requirement(
    id: UUID,
    req_update: EnergyRequirementUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(EnergyRequirement).where(EnergyRequirement.id == id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Energy requirement with ID {id} not found."
        )

    user_role = (current_user.role or "").lower()
    if req.consumer_id != current_user.id and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this energy requirement."
        )

    if req_update.title is not None:
        req.title = req_update.title
    if req_update.energy_required_kwh is not None:
        req.energy_required_kwh = req_update.energy_required_kwh
    if req_update.max_price_per_kwh is not None:
        req.max_price_per_kwh = req_update.max_price_per_kwh
    if req_update.required_from is not None:
        req.required_from = req_update.required_from
    if req_update.required_to is not None:
        req.required_to = req_update.required_to
    if req_update.max_radius_km is not None:
        req.max_radius_km = req_update.max_radius_km
    if req_update.min_seller_reliability is not None:
        req.min_seller_reliability = req_update.min_seller_reliability
    if req_update.preferred_substation_only is not None:
        req.preferred_substation_only = req_update.preferred_substation_only
    if req_update.status is not None:
        req.status = req_update.status

    await db.commit()
    await db.refresh(req)

    coords_res = await db.execute(
        select(ST_Y(req.location), ST_X(req.location))
    )
    lat, lng = coords_res.first()

    return EnergyRequirementResponse(
        id=req.id,
        consumer_id=req.consumer_id,
        consumer_name=current_user.full_name,
        title=req.title,
        energy_required_kwh=float(req.energy_required_kwh),
        max_price_per_kwh=float(req.max_price_per_kwh),
        required_from=req.required_from,
        required_to=req.required_to,
        max_radius_km=float(req.max_radius_km),
        min_seller_reliability=float(req.min_seller_reliability),
        grid_substation_id=req.grid_substation_id,
        preferred_substation_only=req.preferred_substation_only,
        status=req.status,
        latitude=lat if lat is not None else 23.0300,
        longitude=lng if lng is not None else 72.5350,
        created_at=req.created_at
    )

@router.delete("/{id}", response_model=dict)
async def delete_or_cancel_requirement(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(EnergyRequirement).where(EnergyRequirement.id == id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Energy requirement with ID {id} not found."
        )

    user_role = (current_user.role or "").lower()
    if req.consumer_id != current_user.id and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete or cancel this energy requirement."
        )

    req.status = "cancelled"
    await db.commit()

    return {"message": "Energy requirement cancelled successfully.", "id": str(id), "status": "cancelled"}
